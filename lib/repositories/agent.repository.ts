/**
 * FlowMind RAK — Agent Repository
 * Data access for agents and sub-agents
 */
import { getDb } from "../db";
import type { Agent, AgentConfig, SubAgent } from "../types";
import { parseJsonField } from "./base";

interface AgentRow {
  id: string;
  name: string;
  type: string;
  status: string;
  description: string;
  uptime: number;
  task_count: number;
  success_rate: number;
  last_heartbeat: string | null;
  reflex_level: number;
  config: string;
}

interface SubAgentRow {
  id: string;
  parent_id: string;
  name: string;
  status: string;
  spawned_at: string;
  task_description: string;
}

function mapAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Agent["type"],
    status: row.status as Agent["status"],
    description: row.description,
    uptime: row.uptime,
    taskCount: row.task_count,
    successRate: row.success_rate,
    lastHeartbeat: row.last_heartbeat ?? "",
    reflexLevel: row.reflex_level,
    config: parseJsonField<AgentConfig | undefined>(row.config, undefined),
  };
}

function mapSubAgent(row: SubAgentRow): SubAgent {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    status: row.status as SubAgent["status"],
    spawnedAt: row.spawned_at,
    taskDescription: row.task_description,
  };
}

export function getAgents(filters?: { status?: string; type?: string }): Agent[] {
  const db = getDb();
  let sql = "SELECT * FROM agents WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.status) {
    sql += " AND status = ?";
    params.push(filters.status);
  }
  if (filters?.type) {
    sql += " AND type = ?";
    params.push(filters.type);
  }

  sql += " ORDER BY name";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.query(sql).all(...(params as any[])) as AgentRow[]).map(mapAgent);
}

export function getAgentById(id: string): (Agent & { subAgents: SubAgent[] }) | null {
  const db = getDb();
  const row = db.query("SELECT * FROM agents WHERE id = ?").get(id) as AgentRow | null;
  if (!row) return null;

  const subs = db.query("SELECT * FROM sub_agents WHERE parent_id = ?").all(id) as SubAgentRow[];

  return {
    ...mapAgent(row),
    subAgents: subs.map(mapSubAgent),
  };
}

export function updateAgentHeartbeat(id: string): void {
  const db = getDb();
  db.run("UPDATE agents SET last_heartbeat = datetime('now'), updated_at = datetime('now') WHERE id = ?", [id]);
}

export function updateAgentStatus(id: string, status: string): void {
  const db = getDb();
  db.run("UPDATE agents SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id]);
}

export function updateAgentStats(id: string, stats: { taskCount?: number; successRate?: number; uptime?: number }): void {
  const db = getDb();
  const sets: string[] = ["updated_at = datetime('now')"];
  const params: unknown[] = [];

  if (stats.taskCount !== undefined) { sets.push("task_count = ?"); params.push(stats.taskCount); }
  if (stats.successRate !== undefined) { sets.push("success_rate = ?"); params.push(stats.successRate); }
  if (stats.uptime !== undefined) { sets.push("uptime = ?"); params.push(stats.uptime); }

  params.push(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db.run(`UPDATE agents SET ${sets.join(", ")} WHERE id = ?`, params as any[]);
}

export function createSubAgent(data: { parentId: string; name: string; taskDescription: string }): SubAgent {
  const db = getDb();
  const id = `sub-${Date.now()}`;
  db.run(
    "INSERT INTO sub_agents (id, parent_id, name, status, spawned_at, task_description) VALUES (?, ?, ?, 'online', datetime('now'), ?)",
    [id, data.parentId, data.name, data.taskDescription],
  );
  const row = db.query("SELECT * FROM sub_agents WHERE id = ?").get(id) as SubAgentRow;
  return mapSubAgent(row);
}

export function updateAgentConfig(id: string, config: AgentConfig): void {
  const db = getDb();
  db.run("UPDATE agents SET config = ?, updated_at = datetime('now') WHERE id = ?", [JSON.stringify(config), id]);
}
