import { cache } from "react";
import { getSupabase } from "../db";
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

export async function getAgents(filters?: { status?: string; type?: string }): Promise<Agent[]> {
  if (process.env.DASH_BENCH) {
    const g = globalThis as any;
    g.__agentsExec = (g.__agentsExec ?? 0) + 1;
    const fs = await import("fs");
    fs.appendFileSync("dash-bench-agents.log", `[dash-bench] getAgents exec #${g.__agentsExec} ts=${Date.now()}\n`);
  }
  const sb = getSupabase();
  let qb = sb.from("agents").select("*");
  if (filters?.status) qb = qb.eq("status", filters.status);
  if (filters?.type) qb = qb.eq("type", filters.type);
  const { data } = await qb.order("name");
  return ((data ?? []) as AgentRow[]).map(mapAgent);
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
  const sb = getSupabase();
  const { data: agentData } = await sb.from("agents").select("*").eq("id", id).maybeSingle();
  const row = agentData as AgentRow | null;
  if (!row) return null;
  const { data: subsData } = await sb.from("sub_agents").select("*").eq("parent_id", id);
  const subs = (subsData ?? []) as SubAgentRow[];
  return {
    ...mapAgent(row),
    subAgents: subs.map(mapSubAgent),
  };
}

export async function updateAgentHeartbeat(id: string): Promise<void> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  await sb.from("agents").update({ last_heartbeat: now, updated_at: now }).eq("id", id);
}

export async function updateAgentStatus(id: string, status: string): Promise<void> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  await sb.from("agents").update({ status, updated_at: now }).eq("id", id);
}

export async function updateAgentStats(id: string, stats: { taskCount?: number; successRate?: number; uptime?: number }): Promise<void> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };
  if (stats.taskCount !== undefined) update.task_count = stats.taskCount;
  if (stats.successRate !== undefined) update.success_rate = stats.successRate;
  if (stats.uptime !== undefined) update.uptime = stats.uptime;
  await sb.from("agents").update(update).eq("id", id);
}

export async function createSubAgent(data: { parentId: string; name: string; taskDescription: string }): Promise<SubAgent> {
  const sb = getSupabase();
  const id = `sub-${Date.now()}`;
  const now = new Date().toISOString();
  const row: SubAgentRow = {
    id,
    parent_id: data.parentId,
    name: data.name,
    status: "online",
    spawned_at: now,
    task_description: data.taskDescription,
  };
  await sb.from("sub_agents").insert(row);
  return mapSubAgent(row);
}

export async function updateAgentConfig(id: string, config: AgentConfig): Promise<void> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  await sb.from("agents").update({ config: JSON.stringify(config), updated_at: now }).eq("id", id);
}
