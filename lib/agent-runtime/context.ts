/**
 * FlowMind RAK — Context Assembler
 * Gathers all data needed for an agent's "worldview"
 */
import { getDb } from "../db";
import * as memoryRepo from "../repositories/memory.repository";
import type { AgentContext } from "./brain";

export function assembleContext(agentId: string): AgentContext {
  const db = getDb();

  // Pending messages for this agent
  const messages = db.query(
    "SELECT id, from_agent, type, payload FROM rak_messages WHERE (to_agent = ? OR to_agent = '*') AND status = 'pending' ORDER BY created_at DESC LIMIT 10"
  ).all(agentId) as Array<{ id: string; from_agent: string; type: string; payload: string }>;

  // Memories: agent's private + global presets
  const privateMemories = memoryRepo.getMemoriesForAgent(agentId, 5);
  const globalPresets = memoryRepo.getGlobalPresets();
  const memories = [...privateMemories, ...globalPresets];

  // Active tasks assigned to this agent
  const allTasks = db.query(
    "SELECT id, title, status, priority, assigned_agents FROM tasks WHERE status IN ('running', 'pending')"
  ).all() as Array<{ id: string; title: string; status: string; priority: string; assigned_agents: string }>;

  const activeTasks = allTasks
    .filter((t) => {
      try { return JSON.parse(t.assigned_agents).includes(agentId); } catch { return false; }
    })
    .map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority }));

  // Unresolved risk events
  const risks = db.query(
    "SELECT id, level, title, resolved FROM risk_events WHERE resolved = 0 ORDER BY timestamp DESC LIMIT 10"
  ).all() as Array<{ id: string; level: string; title: string; resolved: number }>;

  // System status
  const onlineAgents = (db.query("SELECT COUNT(*) as c FROM agents WHERE status = 'online'").get() as { c: number }).c;
  const busyAgents = (db.query("SELECT COUNT(*) as c FROM agents WHERE status = 'busy'").get() as { c: number }).c;
  const taskQueueLength = (db.query("SELECT COUNT(*) as c FROM tasks WHERE status IN ('pending', 'running')").get() as { c: number }).c;
  const totalTasks = (db.query("SELECT COUNT(*) as c FROM tasks").get() as { c: number }).c;
  const failedTasks = (db.query("SELECT COUNT(*) as c FROM tasks WHERE status = 'failed'").get() as { c: number }).c;
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
    risks: risks.map((r) => ({ ...r, resolved: r.resolved === 1 })),
    systemStatus: { onlineAgents, busyAgents, taskQueueLength, errorRate },
  };
}
