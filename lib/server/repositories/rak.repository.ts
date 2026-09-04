/**
 * FlowMind RAK — RAK Repository
 * Data access for RAK engine persistence (messages, conflicts, consensus, DAG)
 * Prisma Client 版。
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
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

export async function saveMessage(msg: Omit<RAKMessage, "createdAt" | "status">): Promise<RAKMessage> {
  const row = await prisma.rak_messages.create({
    data: {
      id: msg.id,
      from_agent: msg.from,
      to_agent: msg.to,
      type: msg.type,
      protocol: msg.protocol,
      payload: JSON.stringify(msg.payload),
      status: "pending",
      ttl: msg.ttl,
    },
  });
  return mapMessage(row as RAKMessageRow);
}

export async function getMessagesForAgent(agentId: string, status?: string): Promise<RAKMessage[]> {
  const rows = await prisma.rak_messages.findMany({
    where: {
      to_agent: { in: [agentId, "*"] },
      ...(status ? { status } : {}),
    },
    orderBy: { created_at: "desc" },
    take: 100,
  });
  return (rows as RAKMessageRow[] ?? []).map(mapMessage);
}

export async function updateMessageStatus(id: string, status: string): Promise<void> {
  const updateData: Prisma.rak_messagesUpdateInput = { status };
  if (status === "delivered") updateData.delivered_at = new Date().toISOString();
  await prisma.rak_messages.update({ where: { id }, data: updateData });
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

interface DAGNodeRow {
  id: string;
  task_id: string;
  name: string;
  type: string;
  status: string;
  assigned_agent: string | null;
  dependencies: string;
  config: string;
  result: string | null;
  started_at: string | null;
  completed_at: string | null;
}

function mapDAGNode(row: DAGNodeRow): DAGNode {
  return {
    id: row.id,
    taskId: row.task_id,
    name: row.name,
    type: row.type,
    status: row.status,
    assignedAgent: row.assigned_agent ?? undefined,
    dependencies: parseJsonField<string[]>(row.dependencies, []),
    config: parseJsonField(row.config, {}),
    result: row.result ? parseJsonField(row.result, null) : undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
  };
}

export async function saveDAGNode(data: {
  id: string;
  taskId: string;
  name: string;
  type?: string;
  assignedAgent?: string;
  dependencies?: string[];
  config?: unknown;
}): Promise<DAGNode> {
  const row = await prisma.rak_dag_nodes.create({
    data: {
      id: data.id,
      task_id: data.taskId,
      name: data.name,
      type: data.type ?? "task",
      assigned_agent: data.assignedAgent ?? null,
      dependencies: JSON.stringify(data.dependencies ?? []),
      config: JSON.stringify(data.config ?? {}),
    },
  });
  return mapDAGNode(row as DAGNodeRow);
}

export async function getDAGNode(id: string, taskId: string): Promise<DAGNode | null> {
  const row = await prisma.rak_dag_nodes.findFirst({
    where: { id, task_id: taskId },
  });
  if (!row) return null;
  return mapDAGNode(row as DAGNodeRow);
}

export async function getDAGForTask(taskId: string): Promise<DAGNode[]> {
  const rows = await prisma.rak_dag_nodes.findMany({
    where: { task_id: taskId },
    orderBy: { id: "asc" },
  });
  return (rows as DAGNodeRow[] ?? []).map(mapDAGNode);
}

export async function updateDAGNodeStatus(id: string, taskId: string, status: string, result?: unknown): Promise<void> {
  const updateData: Prisma.rak_dag_nodesUpdateInput = { status };
  if (status === "running") updateData.started_at = new Date().toISOString();
  if (status === "completed" || status === "failed") updateData.completed_at = new Date().toISOString();
  if (result !== undefined) updateData.result = JSON.stringify(result);
  await prisma.rak_dag_nodes.updateMany({
    where: { id, task_id: taskId },
    data: updateData,
  });
}
