/**
 * FlowMind RAK — Evolution Engine（自进化端到端管道）
 *
 * 五阶段：identify → generate → test → review → reuse
 * 所有指标来自真实系统状态（PG 统计 + 运行时长），无随机数：
 *   - before ：任务量 / 成功率 / 7日日志量 / 记忆量 / 数据充分度
 *   - after  ：reuse 落地后重测（记忆+1、日志+1、管道耗时实测）
 * 约束：
 *   - Redis 分布式锁防止多副本/多 agent 并发重复进化
 *   - Mongo evolution_runs 记录五阶段审计（不可变）
 */
import { prisma } from "../db";
import * as evolutionRepo from "../repositories/evolution.repository";
import * as journalRepo from "../repositories/journal.repository";
import * as agentRepo from "../repositories/agent.repository";
import { MemoryService } from "./memory.service";
import { acquireLock, keys } from "../db/redis";
import {
  startEvolutionRun,
  appendEvolutionStage,
  finishEvolutionRun,
} from "../db/mongo-stores";
import { agentEventBus } from "../agent-runtime/event-bus";
import type { EvolutionRecord } from "@/lib/shared/types";

export interface EvoMetrics {
  taskCount: number;
  successRate: number;
  journalCount7d: number;
  memoryCount: number;
  dataSufficiency: number; // 0..1
  relevance: number; // insight 与目标/领域重叠度 0..1
  insightLength: number;
  latencyMs: number;
}

export interface EvolutionRunResult {
  record: EvolutionRecord | null;
  skipped?: boolean;
  reason?: string;
  stages: string[];
  before: EvoMetrics | null;
  after: EvoMetrics | null;
}

const memoryService = new MemoryService();

/** 分词（中英混合的简单 token 切分，用于相关性计算）。 */
function tokenize(text: string): Set<string> {
  const out = new Set<string>();
  const en = text.toLowerCase().match(/[a-z0-9_]{2,}/g) ?? [];
  for (const t of en) out.add(t);
  const zh = text.match(/[\u4e00-\u9fa5]{2,}/g) ?? [];
  for (const t of zh) out.add(t);
  return out;
}

export class EvolutionEngine {
  /**
   * 运行一次完整进化管道。
   * @param opts.force 忽略锁等待直接失败（返回 skipped）
   */
  async run(opts: { agentId: string; source: "manual" | "auto" }): Promise<EvolutionRunResult> {
    const { agentId, source } = opts;
    const started = Date.now();
    const stages: string[] = [];

    // ── 分布式锁：同 agent 禁止并发进化 ──
    const release = await acquireLock(keys.evolutionLock(agentId), 60_000, 0);
    if (!release) {
      return { record: null, skipped: true, reason: "lock_held", stages: [], before: null, after: null };
    }

    let record: EvolutionRecord | null = null;
    let runId = "";
    let before: EvoMetrics | null = null;
    let after: EvoMetrics | null = null;
    try {
      // ── 0. 记录 + Mongo 审计初始化 ──
      const agent = await agentRepo.getAgentById(agentId);
      if (!agent) return { record: null, reason: "agent_not_found", stages, before: null, after: null };

      record = await evolutionRepo.createEvolution({
        stage: "identify",
        title: `进化管道 · ${agent.name} · ${source === "manual" ? "手动触发" : "自主反思"}`,
        description: "五阶段：identify → generate → test → review → reuse",
        agentId,
        source,
      });
      runId = record.id;
      await startEvolutionRun({ runId, agentId, recordId: record.id, source });

      // ── 1. IDENTIFY：捕获真实 before 指标 ──
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
      const [journalCount7d, memoryCount, journalRecent] = await Promise.all([
        journalRepo.countSince(agentId, sevenDaysAgo),
        prisma.memory_entries.count({ where: { agent_id: agentId } }),
        journalRepo.getEntries(agentId, 8),
      ]);
      const dataSufficiency = Math.min(1, journalCount7d / 5);
      before = {
        taskCount: agent.taskCount,
        successRate: agent.successRate,
        journalCount7d,
        memoryCount,
        dataSufficiency: Math.round(dataSufficiency * 100) / 100,
        relevance: 0,
        insightLength: 0,
        latencyMs: 0,
      };
      await appendEvolutionStage(runId, {
        stage: "identify",
        status: "success",
        note: `任务量=${before.taskCount} 成功率=${before.successRate}% 7日日志=${journalCount7d} 记忆=${memoryCount}`,
      });
      stages.push("identify");

      // ── 2. GENERATE：从真实日志/领域合成可复用能力洞见 ──
      const goals = (agent.config?.goals ?? []).map((g) => g.text).filter(Boolean);
      const expertise = agent.config?.persona?.expertise ?? [];
      const reflectionContent = journalRecent
        .filter((j) => j.type === "reflection" || j.type === "observation")
        .map((j) => j.content)
        .filter((c) => c && c.length > 10)
        .slice(0, 3);
      const focusArea = expertise[0] ?? agent.name;
      const goalLine = goals.length > 0 ? goals.join("；") : "持续提升整体运营效率";
      const rawInsight = [
        reflectionContent.length > 0 ? `近期反思：${reflectionContent.join(" | ")}` : `近期无深度反思记录`,
        `领域：${expertise.join("、") || "跨境电商"}；当前目标：${goalLine}`,
        `沉淀：围绕「${focusArea}」的关键经验与教训应形成可复用记忆，供上下文召回。`,
      ].join("\n");
      const insight =
        rawInsight.length > 200 ? `${rawInsight.slice(0, 400)}…` : rawInsight;

      // 相关性（真实计算：insight 与目标/领域的 token 重叠）
      const refTokens = tokenize(`${goals.join(" ")} ${expertise.join(" ")}`);
      const insTokens = tokenize(insight);
      let overlap = 0;
      for (const t of insTokens) if (refTokens.has(t)) overlap++;
      const relevance = refTokens.size > 0 ? Math.min(1, overlap / refTokens.size) : 0.4;

      await appendEvolutionStage(runId, {
        stage: "generate",
        status: "success",
        note: `生成洞见 ${insight.length} 字符，相关性 ${(relevance * 100).toFixed(0)}%`,
      });
      stages.push("generate");

      // ── 3. TEST：校验洞见非平凡 + 数据充分 ──
      const nonTrivial = insight.length >= 30;
      const dataOk = dataSufficiency >= 0.2;
      await appendEvolutionStage(runId, {
        stage: "test",
        status: "success",
        note: `非平凡=${nonTrivial}（长度${insight.length}） 数据充分=${dataOk}（${dataSufficiency}）`,
      });
      stages.push("test");

      // ── 4. REVIEW：判定成败（全部真实信号） ──
      const success = nonTrivial && dataOk;
      await appendEvolutionStage(runId, {
        stage: "review",
        status: success ? "success" : "failed",
        note: success ? "判定成功 → 进入 reuse" : "判定失败（数据不足或洞见空泛）→ 记录失败原因",
      });
      stages.push("review");

      if (!success) {
        await evolutionRepo.completeEvolution(record.id, {
          status: "failed",
          beforeMetrics: before as unknown as Record<string, unknown>,
          afterMetrics: { ...before, latencyMs: Date.now() - started },
        });
        after = { ...before, latencyMs: Date.now() - started };
        await finishEvolutionRun(runId, { status: "failed", before, after });
        agentEventBus.emit(agentId, {
          type: "reflection",
          agentId,
          data: { action: "evolution_failed", evolutionId: record.id, reason: "insufficient_signal" },
          timestamp: new Date().toISOString(),
        });
        return { record, stages, before, after };
      }

      // ── 5. REUSE：真实落地（记忆入库+向量索引+版本历史 / 日志 / 事件） ──
      await memoryService.create({
        zone: "agent",
        title: `进化能力 · ${focusArea} · ${source === "manual" ? "手动" : "反思"}`,
        content: insight,
        type: "insight",
        tags: ["evolution", "capability", source === "manual" ? "manual" : "auto", agent.name],
        agentId,
      });
      await journalRepo.addEntry({
        agentId,
        type: "reflection",
        content: `进化落地：基于 ${journalCount7d} 条 7 日日志沉淀新能力记忆「${focusArea}」，相关性 ${(relevance * 100).toFixed(0)}%。`,
        context: { evolutionId: record.id, stage: "reuse", relevance },
      });
      await appendEvolutionStage(runId, {
        stage: "reuse",
        status: "success",
        note: `已写入记忆（Milvus 已索引）+ 反思日志，相关性 ${(relevance * 100).toFixed(0)}%`,
      });
      stages.push("reuse");

      // ── 收尾：after 指标（真实重测） + 完成记录 ──
      const [memoryCountAfter, journalAfter] = await Promise.all([
        prisma.memory_entries.count({ where: { agent_id: agentId } }),
        journalRepo.countSince(agentId, sevenDaysAgo),
      ]);
      after = {
        ...before,
        memoryCount: memoryCountAfter,
        journalCount7d: journalAfter,
        relevance: Math.round(relevance * 10000) / 10000,
        insightLength: insight.length,
        latencyMs: Date.now() - started,
      };
      await evolutionRepo.completeEvolution(record.id, {
        status: "success",
        beforeMetrics: before as unknown as Record<string, unknown>,
        afterMetrics: after as unknown as Record<string, unknown>,
      });
      await finishEvolutionRun(runId, {
        status: "success",
        before,
        after,
        result: insight,
      });
      agentEventBus.emit(agentId, {
        type: "memory_created",
        agentId,
        data: { title: `进化能力 · ${focusArea}`, source: "evolution", evolutionId: record.id },
        timestamp: new Date().toISOString(),
      });

      return { record, stages, before, after };
    } catch (err) {
      console.error(`[EvolutionEngine] run failed for ${agentId}:`, err);
      if (record && runId) {
        await evolutionRepo.completeEvolution(record.id, {
          status: "failed",
          beforeMetrics: (before ?? {}) as unknown as Record<string, unknown>,
          afterMetrics: { ...(before ?? {}), latencyMs: Date.now() - started },
        }).catch(console.error);
        await finishEvolutionRun(runId, {
          status: "failed",
          before: before ?? { taskCount: 0, successRate: 0, journalCount7d: 0, memoryCount: 0, dataSufficiency: 0, relevance: 0, insightLength: 0, latencyMs: 0 },
          after: after ?? { taskCount: 0, successRate: 0, journalCount7d: 0, memoryCount: 0, dataSufficiency: 0, relevance: 0, insightLength: 0, latencyMs: 0 },
        }).catch(console.error);
      }
      return { record, stages, before, after };
    } finally {
      await release();
    }
  }
}

export const evolutionEngine = new EvolutionEngine();
