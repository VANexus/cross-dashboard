/**
 * FlowMind RAK — Context Assembler
 * Gathers all data needed for an agent's "worldview"
 */
import { prisma } from "../db";
import * as memoryRepo from "../repositories/memory.repository";
import * as agentRepo from "../repositories/agent.repository";
import { MemoryService } from "../services/memory.service";
import type { AgentContext } from "./brain";

const memoryService = new MemoryService();

export async function assembleContext(agentId: string): Promise<AgentContext> {
  // Pending messages for this agent（含 to_agent='*' 的广播消息）
  const messages = await prisma.rak_messages.findMany({
    where: {
      OR: [{ to_agent: agentId }, { to_agent: "*" }],
      status: "pending",
    },
    orderBy: { created_at: "desc" },
    take: 10,
    select: { id: true, from_agent: true, type: true, payload: true, created_at: true },
  });

  // Memories: 语义召回（Milvus 混合检索，按 agent 目标/关注点）+ 全局 preset
  const agent = await agentRepo.getAgentById(agentId);
  const goalQuery = (agent?.config?.goals ?? []).map((g) => g.text).filter(Boolean).join(" ");
  const expertise = (agent?.config?.persona?.expertise ?? []).join(" ");
  const recallQuery = `${goalQuery} ${expertise} ${agent?.name ?? ""}`.trim();

  let recalled: Awaited<ReturnType<MemoryService["semanticRecall"]>> = [];
  if (recallQuery) {
    recalled = await memoryService.semanticRecall(recallQuery, agentId, 5);
  }
  const globalPresets = await memoryRepo.getGlobalPresets();
  // 语义召回结果不足时，用该 agent 最近记忆补齐
  const privateRecent =
    recalled.length < 3 ? await memoryRepo.getMemoriesForAgent(agentId, 5 - recalled.length) : [];
  const memories = [...recalled, ...privateRecent, ...globalPresets];

  // Active tasks assigned to this agent
  const allTasks = await prisma.tasks.findMany({
    where: { status: { in: ["running", "pending"] } },
    select: { id: true, title: true, status: true, priority: true, assigned_agents: true },
  });

  const activeTasks = allTasks
    .filter((t) => {
      try { return JSON.parse(t.assigned_agents).includes(agentId); } catch { return false; }
    })
    .map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority }));

  // Unresolved risk events
  // resolved 列为 Int（0=未解决），等价于旧 SQL 的 resolved::boolean = false
  const risks = await prisma.risk_events.findMany({
    where: { resolved: 0 },
    orderBy: { timestamp: "desc" },
    take: 10,
    select: { id: true, level: true, title: true, resolved: true, timestamp: true },
  });

  // System status
  const [onlineAgents, busyAgents, taskQueueLength, totalTasks, failedTasks] = await Promise.all([
    prisma.agents.count({ where: { status: "online" } }),
    prisma.agents.count({ where: { status: "busy" } }),
    prisma.tasks.count({ where: { status: { in: ["pending", "running"] } } }),
    prisma.tasks.count(),
    prisma.tasks.count({ where: { status: "failed" } }),
  ]);

  const errorRate = totalTasks > 0 ? Math.round((failedTasks / totalTasks) * 1000) / 10 : 0;

  return {
    pendingMessages: messages.map((m) => ({
      id: m.id,
      from: m.from_agent,
      type: m.type,
      payload: (() => { try { return JSON.parse(m.payload); } catch { return {}; } })(),
    })),
    memories,
    activeTasks,
    risks: risks.map((r) => ({ ...r, resolved: Boolean(r.resolved) })),
    systemStatus: { onlineAgents, busyAgents, taskQueueLength, errorRate },
  };
}
