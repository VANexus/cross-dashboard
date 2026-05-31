/**
 * FlowMind RAK — Evolution Repository
 * Data access for evolution records and trends
 */
import { getDb } from "../db";
import type { EvolutionRecord } from "../types";
import { paginatedQuery, type PaginatedResult, parseJsonField } from "./base";

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

export function getEvolutionRecords(filters?: {
  stage?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): PaginatedResult<EvolutionRecord> {
  let where = "WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.stage) { where += " AND stage = ?"; params.push(filters.stage); }
  if (filters?.status) { where += " AND status = ?"; params.push(filters.status); }

  const result = paginatedQuery<EvolutionRow>("evolution_records", where, params, filters?.page ?? 1, filters?.pageSize ?? 20);
  return { items: result.items.map(mapEvolution), pagination: result.pagination };
}

export function getEvolutionById(id: string): (EvolutionRecord & { beforeMetrics?: EvolutionRecord["metrics"] }) | null {
  const db = getDb();
  const row = db.query("SELECT * FROM evolution_records WHERE id = ?").get(id) as EvolutionRow | null;
  if (!row) return null;

  return {
    ...mapEvolution(row),
    beforeMetrics: parseJsonField(row.before_metrics, undefined) as EvolutionRecord["metrics"],
  };
}

export function createEvolution(data: {
  stage: string;
  title: string;
  description?: string;
  agentId: string;
}): EvolutionRecord {
  const db = getDb();
  const id = `evo-${Date.now()}`;
  db.run(
    `INSERT INTO evolution_records (id, stage, title, description, agent_id, status)
     VALUES (?, ?, ?, ?, ?, 'in_progress')`,
    [id, data.stage, data.title, data.description ?? "", data.agentId],
  );
  return getEvolutionById(id)!;
}

export function updateEvolution(id: string, data: Partial<EvolutionRecord>): EvolutionRecord | null {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.status !== undefined) {
    sets.push("status = ?"); params.push(data.status);
    if (data.status === "success" || data.status === "failed") {
      // Save current metrics as before_metrics before updating
      const current = db.query("SELECT metrics FROM evolution_records WHERE id = ?").get(id) as { metrics: string | null } | null;
      if (current?.metrics) {
        sets.push("before_metrics = ?");
        params.push(current.metrics);
      }
      sets.push("completed_at = datetime('now')");
    }
  }
  if (data.metrics !== undefined) { sets.push("metrics = ?"); params.push(JSON.stringify(data.metrics)); }
  if (data.completedAt !== undefined) { sets.push("completed_at = ?"); params.push(data.completedAt); }

  if (sets.length === 0) return getEvolutionById(id);
  params.push(id);
  db.run(`UPDATE evolution_records SET ${sets.join(", ")} WHERE id = ?`, params as any[]);
  return getEvolutionById(id);
}

export function getEvolutionTrend(months = 6): { labels: string[]; data: number[] } {
  const db = getDb();

  // Query monthly success rates from completed records
  const rows = db.query(
    `SELECT
       strftime('%Y-%m', completed_at) as month,
       COUNT(*) as total,
       SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success
     FROM evolution_records
     WHERE completed_at IS NOT NULL
     GROUP BY month
     ORDER BY month`
  ).all() as Array<{ month: string; total: number; success: number }>;

  const monthlyRates = new Map<string, number>();
  for (const row of rows) {
    monthlyRates.set(row.month, row.total > 0 ? Math.round((row.success / row.total) * 100) : 0);
  }

  // Fallback: overall average rate for months with no data
  const total = (db.query("SELECT COUNT(*) as c FROM evolution_records").get() as { c: number }).c;
  const success = (db.query("SELECT COUNT(*) as c FROM evolution_records WHERE status = 'success'").get() as { c: number }).c;
  const fallbackRate = total > 0 ? Math.round((success / total) * 100) : 0;

  const labels: string[] = [];
  const data: number[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    labels.push(`${d.getMonth() + 1}月`);
    data.push(monthlyRates.get(key) ?? fallbackRate);
  }

  return { labels, data };
}
