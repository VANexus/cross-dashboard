/**
 * FlowMind RAK — Evolution Repository
 * Data access for evolution records and trends
 */
import { prisma } from "@/lib/server/db";
import type { EvolutionRecord } from "@/lib/shared/types";
import { ignoreNotFound, type PaginatedResult, parseJsonField } from "./base";

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
  source: string | null;
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
    source: (row.source as EvolutionRecord["source"]) ?? "manual",
    metrics: parseJsonField(row.metrics, undefined) as EvolutionRecord["metrics"],
  };
}

export async function getEvolutionRecords(filters?: {
  stage?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<EvolutionRecord>> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (filters?.stage) where.stage = filters.stage;
  if (filters?.status) where.status = filters.status;

  const [total, rows] = await Promise.all([
    prisma.evolution_records.count({ where }),
    prisma.evolution_records.findMany({
      where,
      // 表无 created_at 列（旧代码 order("created_at") 为潜在 bug），按 started_at 倒序实现“最新在前”意图
      orderBy: { started_at: "desc" },
      skip: offset,
      take: pageSize,
    }),
  ]);

  return {
    items: (rows as unknown as EvolutionRow[]).map(mapEvolution),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getEvolutionById(id: string): Promise<(EvolutionRecord & { beforeMetrics?: EvolutionRecord["metrics"] }) | null> {
  const row = (await prisma.evolution_records.findUnique({ where: { id } })) as unknown as EvolutionRow | null;
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
  source?: "manual" | "auto";
}): Promise<EvolutionRecord> {
  const id = `evo-${Date.now()}`;
  await prisma.evolution_records.create({
    data: {
      id,
      stage: data.stage,
      title: data.title,
      description: data.description ?? "",
      agent_id: data.agentId,
      status: "in_progress",
      source: data.source ?? "manual",
    },
  });
  return (await getEvolutionById(id))!;
}

export async function updateEvolution(id: string, data: Partial<EvolutionRecord>): Promise<EvolutionRecord | null> {
  const updateData: Record<string, unknown> = {};

  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "success" || data.status === "failed") {
      const currentRow = await prisma.evolution_records.findUnique({
        where: { id },
        select: { metrics: true },
      });
      if (currentRow?.metrics) {
        updateData.before_metrics = currentRow.metrics;
      }
      updateData.completed_at = new Date().toISOString();
    }
  }
  if (data.metrics !== undefined) updateData.metrics = JSON.stringify(data.metrics);
  if (data.completedAt !== undefined) updateData.completed_at = data.completedAt;

  if (Object.keys(updateData).length === 0) return getEvolutionById(id);
  await ignoreNotFound(() => prisma.evolution_records.update({ where: { id }, data: updateData }));
  return getEvolutionById(id);
}

/**
 * 显式完成进化记录：同时写 before/after 真实指标（自进化引擎专用）。
 * 避免依赖"从 metrics 迁移 before_metrics"的隐式行为。
 */
export async function completeEvolution(
  id: string,
  data: { status: "success" | "failed"; beforeMetrics: Record<string, unknown>; afterMetrics: Record<string, unknown> },
): Promise<EvolutionRecord | null> {
  await ignoreNotFound(() =>
    prisma.evolution_records.update({
      where: { id },
      data: {
        status: data.status,
        metrics: JSON.stringify(data.afterMetrics),
        before_metrics: JSON.stringify(data.beforeMetrics),
        completed_at: new Date().toISOString(),
      },
    }),
  );
  return getEvolutionById(id);
}

export async function getEvolutionTrend(months = 6): Promise<{ labels: string[]; data: number[] }> {
  const rows = await prisma.evolution_records.findMany({
    where: { completed_at: { not: null } },
    select: { completed_at: true, status: true },
  });

  const monthlyCounts = new Map<string, { total: number; success: number }>();
  for (const row of rows) {
    const d = new Date(row.completed_at as unknown as string);
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

  const [totalCount, successCount] = await Promise.all([
    prisma.evolution_records.count(),
    prisma.evolution_records.count({ where: { status: "success" } }),
  ]);
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
