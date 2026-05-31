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

  return (db.query(sql).all(...(params as any[])) as RAKMessageRow[]).map(mapMessage);
}

export function updateMessageStatus(id: string, status: string): void {
  const db = getDb();
  const sets = ["status = ?"];
  const params: unknown[] = [status];
  if (status === "delivered") { sets.push("delivered_at = datetime('now')"); }
  params.push(id);
  db.run(`UPDATE rak_messages SET ${sets.join(", ")} WHERE id = ?`, params as any[]);
}

// ========== Conflicts ==========

export interface RAKConflict {
  id: string;
  taskId: string;
  agents: string[];
  conflictType: string;
  description: string;
  resolution?: string;
  resolvedAt?: string;
  result?: unknown;
  createdAt: string;
}

export function saveConflict(data: {
  taskId: string;
  agents: string[];
  conflictType: string;
  description: string;
}): RAKConflict {
  const db = getDb();
  const id = `conflict-${Date.now()}`;
  db.run(
    `INSERT INTO rak_conflicts (id, task_id, agents, conflict_type, description)
     VALUES (?, ?, ?, ?, ?)`,
    [id, data.taskId, JSON.stringify(data.agents), data.conflictType, data.description],
  );
  const row = db.query("SELECT * FROM rak_conflicts WHERE id = ?").get(id) as {
    id: string; task_id: string; agents: string; conflict_type: string;
    description: string; resolution: string | null; resolved_at: string | null;
    result: string | null; created_at: string;
  };
  return {
    id: row.id, taskId: row.task_id,
    agents: parseJsonField<string[]>(row.agents, []),
    conflictType: row.conflict_type, description: row.description,
    resolution: row.resolution ?? undefined, resolvedAt: row.resolved_at ?? undefined,
    result: row.result ? JSON.parse(row.result) : undefined,
    createdAt: row.created_at,
  };
}

export function resolveConflict(id: string, resolution: string, result: unknown): void {
  const db = getDb();
  db.run(
    `UPDATE rak_conflicts SET resolution = ?, resolved_at = datetime('now'), result = ? WHERE id = ?`,
    [resolution, JSON.stringify(result), id],
  );
}

export function getConflictsForTask(taskId: string): RAKConflict[] {
  const db = getDb();
  const rows = db.query("SELECT * FROM rak_conflicts WHERE task_id = ? ORDER BY created_at DESC").all(taskId) as Array<{
    id: string; task_id: string; agents: string; conflict_type: string;
    description: string; resolution: string | null; resolved_at: string | null;
    result: string | null; created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id, taskId: r.task_id,
    agents: parseJsonField<string[]>(r.agents, []),
    conflictType: r.conflict_type, description: r.description,
    resolution: r.resolution ?? undefined, resolvedAt: r.resolved_at ?? undefined,
    result: r.result ? JSON.parse(r.result) : undefined,
    createdAt: r.created_at,
  }));
}

// ========== Consensus ==========

export interface RAKConsensus {
  id: string;
  proposalId: string;
  proposer: string;
  voters: { agentId: string; vote: string; weight: number }[];
  status: string;
  threshold: number;
  result?: unknown;
  createdAt: string;
  resolvedAt?: string;
}

export function saveConsensus(data: {
  proposalId: string;
  proposer: string;
  threshold?: number;
}): RAKConsensus {
  const db = getDb();
  const id = `consensus-${Date.now()}`;
  db.run(
    `INSERT INTO rak_consensus_log (id, proposal_id, proposer, status, threshold)
     VALUES (?, ?, ?, 'pending', ?)`,
    [id, data.proposalId, data.proposer, data.threshold ?? 0.67],
  );
  return {
    id, proposalId: data.proposalId, proposer: data.proposer,
    voters: [], status: "pending", threshold: data.threshold ?? 0.67,
    createdAt: new Date().toISOString(),
  };
}

export function getConsensus(id: string): RAKConsensus | null {
  const db = getDb();
  const row = db.query("SELECT * FROM rak_consensus_log WHERE id = ?").get(id) as {
    id: string; proposal_id: string; proposer: string; voters: string;
    status: string; threshold: number; result: string | null;
    created_at: string; resolved_at: string | null;
  } | null;
  if (!row) return null;
  return {
    id: row.id, proposalId: row.proposal_id, proposer: row.proposer,
    voters: parseJsonField<Array<{ agentId: string; vote: string; weight: number }>>(row.voters, []),
    status: row.status, threshold: row.threshold,
    result: row.result ? JSON.parse(row.result) : undefined,
    createdAt: row.created_at, resolvedAt: row.resolved_at ?? undefined,
  };
}

export function addVote(consensusId: string, agentId: string, vote: string, weight: number): void {
  const db = getDb();
  const row = db.query("SELECT voters FROM rak_consensus_log WHERE id = ?").get(consensusId) as { voters: string } | null;
  if (!row) return;

  const voters = parseJsonField<Array<{ agentId: string; vote: string; weight: number }>>(row.voters, []);
  const existing = voters.findIndex((v) => v.agentId === agentId);
  if (existing >= 0) {
    voters[existing] = { agentId, vote, weight };
  } else {
    voters.push({ agentId, vote, weight });
  }

  db.run("UPDATE rak_consensus_log SET voters = ? WHERE id = ?", [JSON.stringify(voters), consensusId]);
}

export function resolveConsensus(id: string, status: "accepted" | "rejected", result: unknown): void {
  const db = getDb();
  db.run(
    `UPDATE rak_consensus_log SET status = ?, resolved_at = datetime('now'), result = ? WHERE id = ?`,
    [status, JSON.stringify(result), id],
  );
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
  db.run(`UPDATE rak_dag_nodes SET ${sets.join(", ")} WHERE id = ? AND task_id = ?`, params as any[]);
}
