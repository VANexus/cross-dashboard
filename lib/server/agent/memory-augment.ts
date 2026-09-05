/**
 * 对话链路「记忆 / 自进化 / Agent 赋能」增强（服务端，仅供 chat 路由 / tool 层使用）
 *
 * 三件事，把之前「展示层」的记忆/自进化/Agent 管理真正接进对话驱动的工作流：
 *  1. buildMemoryAugment() —— 把 Agent 语义召回记忆 + 自进化能力 + Agent 人格注入 system prompt，
 *     让对话 Agent 引用真实沉淀的记忆与已进化能力来回答问题、辅助决策。
 *  2. memorySearchTool / memoryStoreTool —— 对话中的记忆查询 / 写入工具（Milvus 混合检索 / 三库写回）。
 *  3. recordToolOutcome() —— 业务工具执行成功后沉淀 outcome 记忆（工作流 → 记忆反馈闭环），
 *     记忆量随真实工作增长，Milvus 索引持续积累，供后续召回。
 */
import * as agentRepo from "../repositories/agent.repository";
import { MemoryService } from "../services/memory.service";
import type { MemoryEntry } from "@/lib/shared/types";

const memoryService = new MemoryService();

// ── C2：召回增强缓存（20 分钟 TTL，进程内）──────────────────────────
// 每轮对话都要做一次 Milvus 检索 + 能力清单查询（embedding + PG 读），
// 高频问答下是无意义的重复成本。以 (agentId, query) 为键做时间窗口缓存，
// 记忆/进化的沉淀在 20 分钟内收敛到下一轮可见，代价可接受。
const AUGMENT_CACHE_TTL_MS = 20 * 60 * 1000;
const augmentCache = new Map<
  string,
  { block: string; memories: MemoryEntry[]; capabilities: MemoryEntry[]; at: number }
>();

// ── C1：工具 outcome 记忆写闸门 ─────────────────────────────────────
// 1) 价值过滤：空/占位/无信息量的输出不沉淀（避免脏记忆灌库）；
// 2) 进程内去重：同 tool + 同摘要片段，24h 窗口内只写一次
//    （工具重复执行（如多次跑同一趋势查询）不应重复产生几乎相同的记忆条目）。
const OUTCOME_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;
const OUTCOME_MIN_LEN = 12;
const outcomeCache = new Map<string, number>();

function isBoringOutcome(summary: string): boolean {
  const s = summary.trim();
  if (!s || s.length < OUTCOME_MIN_LEN) return true;
  if (/^(\[object Object\]|undefined|null|\{\}|\[\])$/i.test(s)) return true;
  return false;
}

function pruneOutcomeCache(): void {
  const now = Date.now();
  if (outcomeCache.size <= 2000) return;
  for (const [k, t] of outcomeCache) {
    if (now - t > OUTCOME_DEDUP_WINDOW_MS) outcomeCache.delete(k);
  }
}

export interface AgentIdentity {
  agentId: string;
  name: string;
  type?: string;
  expertise: string[];
  goals: string[];
}

/** 解析绑定 Agent 的人格/目标（用于 chat 的 agentId 参数）。 */
export async function resolveAgentIdentity(agentId?: string): Promise<AgentIdentity | null> {
  if (!agentId) return null;
  try {
    const agent = await agentRepo.getAgentById(agentId);
    if (!agent) return null;
    const config = agent.config as unknown as {
      persona?: { expertise?: string[] };
      goals?: Array<{ text?: string; title?: string }>;
    };
    return {
      agentId,
      name: agent.name,
      type: agent.type,
      expertise: config?.persona?.expertise ?? [],
      goals: (config?.goals ?? [])
        .map((g) => g?.text ?? g?.title)
        .filter((s): s is string => Boolean(s)),
    };
  } catch {
    return null;
  }
}

/**
 * 构建注入 system prompt 的记忆增强块：
 *  - Agent 人格/目标（若绑定）
 *  - 自进化能力（tag 含 evolution/capability 的记忆，来自进化引擎/反思）
 *  - 语义召回记忆（按目标/领域/当前问题，Milvus 混合检索）
 */
export async function buildMemoryAugment(opts: {
  identity?: AgentIdentity | null;
  query?: string;
  recallLimit?: number;
  capLimit?: number;
}): Promise<{ block: string; memories: MemoryEntry[]; capabilities: MemoryEntry[] }> {
  const { identity } = opts;
  const recallQuery =
    [identity?.goals?.[0], identity?.expertise?.[0], opts.query].filter(Boolean).join("；") || "运营经验";

  // C2：命中 TTL 窗口内缓存的增强块，直接复用（跳过 Milvus 检索 + 能力清单读库）
  const cacheKey = `${identity?.agentId ?? "global"}|${recallQuery}`.slice(0, 140);
  const cached = augmentCache.get(cacheKey);
  if (cached && Date.now() - cached.at < AUGMENT_CACHE_TTL_MS) {
    return { block: cached.block, memories: cached.memories, capabilities: cached.capabilities };
  }

  let memories: MemoryEntry[] = [];
  let capabilities: MemoryEntry[] = [];
  try {
    memories = await memoryService.semanticRecall(recallQuery, identity?.agentId, opts.recallLimit ?? 4);
  } catch (e) {
    console.error("[memory-augment] semanticRecall failed:", (e as Error).message);
  }
  try {
    const caps = await memoryService.list({ page: 1, pageSize: 12 });
    capabilities = (caps.items ?? []).filter((m) =>
      (m.tags ?? []).some((t) => /evolution|capability/i.test(t)),
    );
  } catch (e) {
    console.error("[memory-augment] capability list failed:", (e as Error).message);
  }

  const lines: string[] = [];
  if (identity?.name) {
    lines.push(`## 当前绑定 Agent：${identity.name}${identity.type ? `（${identity.type}）` : ""}`);
    if (identity.expertise?.length) lines.push(`专业领域：${identity.expertise.join("、")}`);
    if (identity.goals?.length) lines.push(`当前目标：${identity.goals.slice(0, 3).join("；")}`);
  }
  if (capabilities.length) {
    lines.push("## 本系统已沉淀的自进化能力（来自进化引擎/Agent 反思，回答相关问题时请优先引用）");
    for (const c of capabilities.slice(0, opts.capLimit ?? 4)) {
      lines.push(`- ${c.title}：${(c.content ?? "").slice(0, 140).replace(/\s+/g, " ")}`);
    }
  }
  if (memories.length) {
    lines.push("## 相关记忆（语义召回，来自 PG+Milvus+Mongo 记忆系统；可继续用 memory_search 深查）");
    for (const m of memories) {
      lines.push(
        `- [${(m.tags ?? []).join(",") || "memory"}][${m.agentId ?? "global"}] ${m.title}：${(m.content ?? "")
          .slice(0, 180)
          .replace(/\s+/g, " ")}`,
      );
    }
  }

  let block = "";
  if (lines.length > 0) block = "\n" + lines.join("\n") + "\n";

  augmentCache.set(cacheKey, { block, memories, capabilities, at: Date.now() });
  return { block, memories, capabilities };
}

/** 业务工具执行成功后沉淀 outcome 记忆（fire-and-forget，三库写回，失败不阻断主链路）。 */
export async function recordToolOutcome(opts: {
  toolName: string;
  agentId?: string;
  title?: string;
  summary: string;
}): Promise<void> {
  try {
    // C1 门槛①：价值过滤 —— 空/占位/无信息量输出不沉淀
    if (isBoringOutcome(opts.summary)) return;
    // C1 门槛②：幂等去重 —— 同工具同摘要片段 24h 内只写一次
    const dedupKey = `${opts.toolName}|${opts.summary.slice(0, 100)}`;
    const now = Date.now();
    const lastAt = outcomeCache.get(dedupKey);
    if (lastAt && now - lastAt < OUTCOME_DEDUP_WINDOW_MS) return;
    outcomeCache.set(dedupKey, now);
    pruneOutcomeCache();

    await memoryService.create({
      zone: "agent",
      title: opts.title ?? `工具执行 · ${opts.toolName}`,
      content: opts.summary.slice(0, 1000),
      type: "insight",
      tags: ["auto-generated", "tool", opts.toolName, "outcome"],
      agentId: opts.agentId,
    });
  } catch (e) {
    console.error(`[memory-augment] tool outcome record failed (${opts.toolName}):`, (e as Error).message);
  }
}
