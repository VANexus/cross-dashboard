/**
 * FlowMind RAK — RAK Repository
 * Data access for RAK engine persistence (messages, conflicts, consensus, DAG)
 */
import { getDb } from "../db";
import { parseJsonField } from "./base";

// ========== Messages ==========

export interface RAKMessageRow {
  id: string;
  from_agent: string;
  to_agent: string;
  type: string;
  protocol: string;
  payload: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  ttl: number;
}

export interface RAKMessage {
  id: string;
  from: string;
  to: string;
  type: "request" | "response" | "event" | "heartbeat";
  protocol: string;
  payload: { action: string; data: unknown; correlationId?: string };
  status: string;
  createdAt: string;
  deliveredAt?: string;
  ttl: number;
}

function mapMessage(row: RAKMessageRow): RAKMessage {
  return {
    id: row.id,
    from: row.from_agent,
    to: row.to_agent,
    type: row.type as RAKMessage["type"],
    protocol: row.protocol,
    payload: parseJsonField(row.payload, { action: "", data: null }),
    status: row.status,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at ?? undefined,
    ttl: row.ttl,
  };
}

export function saveMessage(msg: Omit<RAKMessage, "createdAt" | "status">): RAKMessage {
  const db = getDb();
  db.run(
    `INSERT INTO rak_messages (id, from_agent, to_agent, type, protocol, payload, status, ttl)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [msg.id, msg.from, msg.to, msg.type, msg.protocol,
    JSON.stringify(msg.payload), msg.ttl],
  );
  const row = db.query("SELECT * FROM rak_messages WHERE id = ?").get(msg.id) as RAKMessageRow;
  return mapMessage(row);
}

export function getMessagesForAgent(agentId: string, status?: string): RAKMessage[] {
  const db = getDb();
  let sql = "SELECT * FROM rak_messages WHERE (to_agent = ? OR to_agent = '*')";
  const params: unknown[] = [agentId];
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY created_at DESC LIMIT 100";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.query(sql).all(...(params as any[])) as RAKMessageRow[]).map(mapMessage);
}

export function updateMessageStatus(id: string, status: string): void {
  const db = getDb();
  const sets = ["status = ?"];
  const params: unknown[] = [status];
  if (status === "delivered") { sets.push("delivered_at = datetime('now')"); }
  params.push(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db.run(`UPDATE rak_messages SET ${sets.join(", ")} WHERE id = ?`, params as any[]);
}

// ========== DAG Nodes ==========

export interface DAGNode {
  id: string;
  taskId: string;
  name: string;
  type: string;
  status: string;
  assignedAgent?: string;
  dependencies: string[];
  config: unknown;
  result?: unknown;
  startedAt?: string;
  completedAt?: string;
}

export function saveDAGNode(data: {
  id: string;
  taskId: string;
  name: string;
  type?: string;
  assignedAgent?: string;
  dependencies?: string[];
  config?: unknown;
}): DAGNode {
  const db = getDb();
  db.run(
    `INSERT INTO rak_dag_nodes (id, task_id, name, type, assigned_agent, dependencies, config)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.id, data.taskId, data.name, data.type ?? "task",
    data.assignedAgent ?? null, JSON.stringify(data.dependencies ?? []),
    JSON.stringify(data.config ?? {})],
  );
  return getDAGNode(data.id, data.taskId)!;
}

export function getDAGNode(id: string, taskId: string): DAGNode | null {
  const db = getDb();
  const row = db.query("SELECT * FROM rak_dag_nodes WHERE id = ? AND task_id = ?").get(id, taskId) as {
    id: string; task_id: string; name: string; type: string; status: string;
    assigned_agent: string | null; dependencies: string; config: string;
    result: string | null; started_at: string | null; completed_at: string | null;
  } | null;
  if (!row) return null;
  return {
    id: row.id, taskId: row.task_id, name: row.name, type: row.type,
    status: row.status, assignedAgent: row.assigned_agent ?? undefined,
    dependencies: parseJsonField<string[]>(row.dependencies, []),
    config: parseJsonField(row.config, {}),
    result: row.result ? JSON.parse(row.result) : undefined,
    startedAt: row.started_at ?? undefined, completedAt: row.completed_at ?? undefined,
  };
}

export function getDAGForTask(taskId: string): DAGNode[] {
  const db = getDb();
  const rows = db.query("SELECT * FROM rak_dag_nodes WHERE task_id = ? ORDER BY id").all(taskId) as Array<{
    id: string; task_id: string; name: string; type: string; status: string;
    assigned_agent: string | null; dependencies: string; config: string;
    result: string | null; started_at: string | null; completed_at: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id, taskId: r.task_id, name: r.name, type: r.type,
    status: r.status, assignedAgent: r.assigned_agent ?? undefined,
    dependencies: parseJsonField<string[]>(r.dependencies, []),
    config: parseJsonField(r.config, {}),
    result: r.result ? JSON.parse(r.result) : undefined,
    startedAt: r.started_at ?? undefined, completedAt: r.completed_at ?? undefined,
  }));
}

export function updateDAGNodeStatus(id: string, taskId: string, status: string, result?: unknown): void {
  const db = getDb();
  const sets = ["status = ?"];
  const params: unknown[] = [status];
  if (status === "running") sets.push("started_at = datetime('now')");
  if (status === "completed" || status === "failed") sets.push("completed_at = datetime('now')");
  if (result !== undefined) { sets.push("result = ?"); params.push(JSON.stringify(result)); }
  params.push(id, taskId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db.run(`UPDATE rak_dag_nodes SET ${sets.join(", ")} WHERE id = ? AND task_id = ?`, params as any[]);
}
