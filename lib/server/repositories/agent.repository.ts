import { cache } from "react";
import { prisma } from "@/lib/server/db";
import type { Agent, AgentConfig, SubAgent } from "@/lib/shared/types";
import { ignoreNotFound, parseJsonField } from "./base";

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

export async function createAgent(data: {
  id: string;
  name: string;
  type: string;
  description?: string;
  config: unknown;
  status?: string;
}): Promise<Agent> {
  const row = (await prisma.agents.create({
    data: {
      id: data.id,
      name: data.name,
      type: data.type,
      status: data.status ?? "online",
      description: data.description ?? "",
      config: JSON.stringify(data.config),
      last_heartbeat: new Date().toISOString(),
    },
  })) as unknown as AgentRow;
  return mapAgent(row);
}

export async function getAgents(filters?: { status?: string; type?: string }): Promise<Agent[]> {
  if (process.env.DASH_BENCH) {
    const g = globalThis as any;
    g.__agentsExec = (g.__agentsExec ?? 0) + 1;
    const fs = await import("fs");
    fs.appendFileSync("dash-bench-agents.log", `[dash-bench] getAgents exec #${g.__agentsExec} ts=${Date.now()}\n`);
  }
  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.type) where.type = filters.type;
  const rows = await prisma.agents.findMany({ where, orderBy: { name: "asc" } });
  return (rows as unknown as AgentRow[]).map(mapAgent);
}

/**
 * Agent 列表的 RSC 请求级共享访问点（无 filters 版）。
 * 同一 RSC render-pass 内（dashboard 的 Heartbeat/Topology island 与 getStats）
 * 只执行一次 getAgents()，消除重复的 agents 查询；route handler 中每次执行。
 */
export const getAgentsShared = cache(async function getAgentsShared(): Promise<Agent[]> {
  return getAgents();
});

export async function getAgentById(id: string): Promise<(Agent & { subAgents: SubAgent[] }) | null> {
  const row = (await prisma.agents.findUnique({ where: { id } })) as unknown as AgentRow | null;
  if (!row) return null;
  const subs = (await prisma.sub_agents.findMany({ where: { parent_id: id } })) as unknown as SubAgentRow[];
  return {
    ...mapAgent(row),
    subAgents: subs.map(mapSubAgent),
  };
}

export async function updateAgentHeartbeat(id: string): Promise<void> {
  const now = new Date().toISOString();
  await ignoreNotFound(() => prisma.agents.update({ where: { id }, data: { last_heartbeat: now, updated_at: now } }));
  // Redis 实时在场（TTL=3×默认心跳间隔，供跨实例实时状态）
  try {
    const { getRedis, keys } = await import("../db/redis");
    await getRedis()
      .set(keys.agentPresence(id), JSON.stringify({ last: now, pid: process.pid }), "EX", 180)
      .catch(() => {});
  } catch {
    /* 心跳主链路不受 Redis 抖动影响 */
  }
}

/** 删除 Agent（级联：子 Agent / 日志 / 进化记录 / 消息），并清理 Redis 在场。 */
export async function deleteAgent(id: string): Promise<boolean> {
  await prisma.$transaction([
    prisma.sub_agents.deleteMany({ where: { parent_id: id } }),
    prisma.evolution_records.deleteMany({ where: { agent_id: id } }),
    prisma.rak_messages.deleteMany({ where: { OR: [{ from_agent: id }, { to_agent: id }] } }),
  ]);
  // agent_journal 已迁 Mongo：删除 agent 时同步清空其 Mongo 轨迹
  try {
    const { getMongoDb, COLLECTIONS } = await import("../db/mongo");
    const mdb = await getMongoDb();
    await mdb.collection(COLLECTIONS.agentJournal).deleteMany({ agentId: id });
  } catch {
    /* Mongo 清理失败不阻断删除主链路 */
  }
  await ignoreNotFound(() => prisma.agents.delete({ where: { id } }));
  try {
    const { getRedis, keys } = await import("../db/redis");
    await getRedis().del(keys.agentPresence(id)).catch(() => {});
  } catch {
    /* 忽略 */
  }
  return true;
}

export async function updateAgentStatus(id: string, status: string): Promise<void> {
  const now = new Date().toISOString();
  await ignoreNotFound(() => prisma.agents.update({ where: { id }, data: { status, updated_at: now } }));
}

export async function updateAgentStats(id: string, stats: { taskCount?: number; successRate?: number; uptime?: number }): Promise<void> {
  const now = new Date().toISOString();
  const data: Record<string, unknown> = { updated_at: now };
  if (stats.taskCount !== undefined) data.task_count = stats.taskCount;
  if (stats.successRate !== undefined) data.success_rate = stats.successRate;
  if (stats.uptime !== undefined) data.uptime = stats.uptime;
  await ignoreNotFound(() => prisma.agents.update({ where: { id }, data }));
}

export async function createSubAgent(data: { parentId: string; name: string; taskDescription: string }): Promise<SubAgent> {
  const id = `sub-${Date.now()}`;
  const now = new Date().toISOString();
  const row = await prisma.sub_agents.create({
    data: {
      id,
      parent_id: data.parentId,
      name: data.name,
      status: "online",
      spawned_at: now,
      task_description: data.taskDescription,
    },
  });
  return mapSubAgent(row as unknown as SubAgentRow);
}

export async function updateAgentConfig(id: string, config: AgentConfig): Promise<void> {
  const now = new Date().toISOString();
  await ignoreNotFound(() => prisma.agents.update({ where: { id }, data: { config: JSON.stringify(config), updated_at: now } }));
}
