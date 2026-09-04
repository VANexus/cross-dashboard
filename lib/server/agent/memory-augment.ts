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

  if (lines.length === 0) return { block: "", memories, capabilities };
  return { block: "\n" + lines.join("\n") + "\n", memories, capabilities };
}

/** 业务工具执行成功后沉淀 outcome 记忆（fire-and-forget，三库写回，失败不阻断主链路）。 */
export async function recordToolOutcome(opts: {
  toolName: string;
  agentId?: string;
  title?: string;
  summary: string;
}): Promise<void> {
  try {
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
