/**
 * FlowMind RAK — Evolution Repository
 * Data access for evolution records and trends
 */
import { getSupabase } from "../db";
import type { EvolutionRecord } from "../types";
import { type PaginatedResult, parseJsonField } from "./base";

interface EvolutionRow {
  id: string;
  stage: string;
  title: string;
  description: string;
  agent_id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  metrics: string | null;
  before_metrics: string | null;
}

function mapEvolution(row: EvolutionRow): EvolutionRecord {
  return {
    id: row.id,
    stage: row.stage as EvolutionRecord["stage"],
    title: row.title,
    description: row.description,
    agentId: row.agent_id,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    status: row.status as EvolutionRecord["status"],
    metrics: parseJsonField(row.metrics, undefined) as EvolutionRecord["metrics"],
  };
}

export async function getEvolutionRecords(filters?: {
  stage?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<EvolutionRecord>> {
  const sb = getSupabase();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  let query = sb.from("evolution_records").select("*", { count: "exact" });
  if (filters?.stage) query = query.eq("stage", filters.stage);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const rows = (data as EvolutionRow[] ?? []);
  const total = count ?? 0;

  return {
    items: rows.map(mapEvolution),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getEvolutionById(id: string): Promise<(EvolutionRecord & { beforeMetrics?: EvolutionRecord["metrics"] }) | null> {
  const sb = getSupabase();
  const { data } = await sb.from("evolution_records").select("*").eq("id", id).maybeSingle();
  const row = data as EvolutionRow | null;
  if (!row) return null;

  return {
    ...mapEvolution(row),
    beforeMetrics: parseJsonField(row.before_metrics, undefined) as EvolutionRecord["metrics"],
  };
}

export async function createEvolution(data: {
  stage: string;
  title: string;
  description?: string;
  agentId: string;
}): Promise<EvolutionRecord> {
  const sb = getSupabase();
  const id = `evo-${Date.now()}`;
  await sb.from("evolution_records").insert({
    id,
    stage: data.stage,
    title: data.title,
    description: data.description ?? "",
    agent_id: data.agentId,
    status: "in_progress",
  });
  return (await getEvolutionById(id))!;
}

export async function updateEvolution(id: string, data: Partial<EvolutionRecord>): Promise<EvolutionRecord | null> {
  const sb = getSupabase();
  const updateData: Record<string, unknown> = {};

  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "success" || data.status === "failed") {
      const { data: current } = await sb
        .from("evolution_records")
        .select("metrics")
        .eq("id", id)
        .maybeSingle();
      const currentRow = current as { metrics: string | null } | null;
      if (currentRow?.metrics) {
        updateData.before_metrics = currentRow.metrics;
      }
      updateData.completed_at = new Date().toISOString();
    }
  }
  if (data.metrics !== undefined) updateData.metrics = JSON.stringify(data.metrics);
  if (data.completedAt !== undefined) updateData.completed_at = data.completedAt;

  if (Object.keys(updateData).length === 0) return getEvolutionById(id);
  await sb.from("evolution_records").update(updateData).eq("id", id);
  return getEvolutionById(id);
}

export async function getEvolutionTrend(months = 6): Promise<{ labels: string[]; data: number[] }> {
  const sb = getSupabase();

  const { data } = await sb
    .from("evolution_records")
    .select("completed_at, status")
    .not("completed_at", "is", null);

  const rows = (data as Array<{ completed_at: string; status: string }> ?? []);

  const monthlyCounts = new Map<string, { total: number; success: number }>();
  for (const row of rows) {
    const d = new Date(row.completed_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyCounts.has(key)) {
      monthlyCounts.set(key, { total: 0, success: 0 });
    }
    const entry = monthlyCounts.get(key)!;
    entry.total++;
    if (row.status === "success") entry.success++;
  }

  const monthlyRates = new Map<string, number>();
  for (const [key, val] of monthlyCounts) {
    monthlyRates.set(key, val.total > 0 ? Math.round((val.success / val.total) * 100) : 0);
  }

  const { count: totalCount } = await sb
    .from("evolution_records")
    .select("*", { count: "exact", head: true });
  const { count: successCount } = await sb
    .from("evolution_records")
    .select("*", { count: "exact", head: true })
    .eq("status", "success");
  const total = totalCount ?? 0;
  const success = successCount ?? 0;
  const fallbackRate = total > 0 ? Math.round((success / total) * 100) : 0;

  const labels: string[] = [];
  const dataArr: number[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    labels.push(`${d.getMonth() + 1}月`);
    dataArr.push(monthlyRates.get(key) ?? fallbackRate);
  }

  return { labels, data: dataArr };
}
