/**
 * FlowMind RAK — Context Assembler
 * Gathers all data needed for an agent's "worldview"
 */
import { getSupabase } from "../db";
import * as memoryRepo from "../repositories/memory.repository";
import type { AgentContext } from "./brain";

export async function assembleContext(agentId: string): Promise<AgentContext> {
  const sb = getSupabase();

  // Pending messages for this agent
  const { data: msgRows } = await sb
    .from("rak_messages")
    .select("id, from_agent, type, payload, created_at")
    .or(`to_agent.eq.${agentId},to_agent.eq.*`)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);
  const messages = (msgRows ?? []) as Array<{ id: string; from_agent: string; type: string; payload: string }>;

  // Memories: agent's private + global presets
  const [privateMemories, globalPresets] = await Promise.all([
    memoryRepo.getMemoriesForAgent(agentId, 5),
    memoryRepo.getGlobalPresets(),
  ]);
  const memories = [...privateMemories, ...globalPresets];

  // Active tasks assigned to this agent
  const { data: taskRows } = await sb
    .from("tasks")
    .select("id, title, status, priority, assigned_agents")
    .in("status", ["running", "pending"]);
  const allTasks = (taskRows ?? []) as Array<{ id: string; title: string; status: string; priority: string; assigned_agents: string }>;

  const activeTasks = allTasks
    .filter((t) => {
      try { return JSON.parse(t.assigned_agents).includes(agentId); } catch { return false; }
    })
    .map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority }));

  // Unresolved risk events
  const { data: riskRows } = await sb
    .from("risk_events")
    .select("id, level, title, resolved, timestamp")
    .eq("resolved", false)
    .order("timestamp", { ascending: false })
    .limit(10);
  const risks = (riskRows ?? []) as Array<{ id: string; level: string; title: string; resolved: boolean | number }>;

  // System status
  const { count: onlineAgentCount } = await sb.from("agents").select("*", { count: "exact", head: true }).eq("status", "online");
  const { count: busyAgentCount } = await sb.from("agents").select("*", { count: "exact", head: true }).eq("status", "busy");
  const { count: queuedCount } = await sb.from("tasks").select("*", { count: "exact", head: true }).in("status", ["pending", "running"]);
  const { count: totalCount } = await sb.from("tasks").select("*", { count: "exact", head: true });
  const { count: failedCount } = await sb.from("tasks").select("*", { count: "exact", head: true }).eq("status", "failed");

  const onlineAgents = onlineAgentCount ?? 0;
  const busyAgents = busyAgentCount ?? 0;
  const taskQueueLength = queuedCount ?? 0;
  const totalTasks = totalCount ?? 0;
  const failedTasks = failedCount ?? 0;
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
    risks: risks.map((r) => ({ ...r, resolved: r.resolved === 1 || r.resolved === true })),
    systemStatus: { onlineAgents, busyAgents, taskQueueLength, errorRate },
  };
}
