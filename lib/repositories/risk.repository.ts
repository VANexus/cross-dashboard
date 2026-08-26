/**
 * FlowMind RAK — Risk Repository
 * Data access for risk events, health, and isolation
 */
import { getDb } from "../db";
import type { RiskEvent, HealthDimension, RiskIndicator } from "../types";
import { paginatedQuery, type PaginatedResult, parseJsonField } from "./base";

interface RiskRow {
  id: string;
  level: string;
  title: string;
  description: string;
  source: string;
  timestamp: string;
  resolved: number;
  resolved_at: string | null;
  actions: string;
}

interface IsolationRow {
  id: number;
  label: string;
  description: string;
  checked: number;
}

function mapRisk(row: RiskRow): RiskEvent {
  return {
    id: row.id,
    level: row.level as RiskEvent["level"],
    title: row.title,
    description: row.description,
    source: row.source,
    timestamp: row.timestamp,
    resolved: row.resolved === 1,
    resolvedAt: row.resolved_at ?? undefined,
    actions: parseJsonField<string[]>(row.actions, []),
  };
}

export function getRiskEvents(filters?: {
  level?: string;
  resolved?: boolean;
  page?: number;
  pageSize?: number;
}): PaginatedResult<RiskEvent> {
  let where = "WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.level) { where += " AND level = ?"; params.push(filters.level); }
  if (filters?.resolved !== undefined) { where += " AND resolved = ?"; params.push(filters.resolved ? 1 : 0); }

  const result = paginatedQuery<RiskRow>("risk_events", where, params, filters?.page ?? 1, filters?.pageSize ?? 20);
  return { items: result.items.map(mapRisk), pagination: result.pagination };
}

export function getRiskEventById(id: string): RiskEvent | null {
  const db = getDb();
  const row = db.query("SELECT * FROM risk_events WHERE id = ?").get(id) as RiskRow | null;
  return row ? mapRisk(row) : null;
}

export function createRiskEvent(data: {
  level: string;
  title: string;
  description?: string;
  source?: string;
  actions?: string[];
}): RiskEvent {
  const db = getDb();
  const id = `risk-${Date.now()}`;
  db.run(
    `INSERT INTO risk_events (id, level, title, description, source, actions)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.level, data.title, data.description ?? "", data.source ?? "",
    JSON.stringify(data.actions ?? [])],
  );
  return getRiskEventById(id)!;
}

export function updateRiskEvent(id: string, data: { resolved?: boolean; resolvedAt?: string }): RiskEvent | null {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.resolved !== undefined) { sets.push("resolved = ?"); params.push(data.resolved ? 1 : 0); }
  if (data.resolvedAt !== undefined) { sets.push("resolved_at = ?"); params.push(data.resolvedAt); }
  if (data.resolved && !data.resolvedAt) sets.push("resolved_at = datetime('now')");

  if (sets.length === 0) return getRiskEventById(id);
  params.push(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db.run(`UPDATE risk_events SET ${sets.join(", ")} WHERE id = ?`, params as any[]);
  return getRiskEventById(id);
}

export function getIsolationItems(): { label: string; desc: string; checked: boolean }[] {
  const db = getDb();
  const rows = db.query("SELECT * FROM risk_isolation ORDER BY id").all() as IsolationRow[];
  return rows.map((r) => ({ label: r.label, desc: r.description, checked: r.checked === 1 }));
}

export function updateIsolationItem(index: number, checked: boolean): boolean {
  const db = getDb();
  const row = db.query("SELECT id FROM risk_isolation ORDER BY id LIMIT 1 OFFSET ?").get(index) as { id: number } | null;
  if (!row) return false;
  db.run("UPDATE risk_isolation SET checked = ? WHERE id = ?", [checked ? 1 : 0, row.id]);
  return true;
}

export function getHealthData(): {
  score: number;
  dimensions: HealthDimension[];
  indicators: RiskIndicator[];
} {
  const db = getDb();
  const unresolved = (db.query("SELECT COUNT(*) as c FROM risk_events WHERE resolved = 0").get() as { c: number }).c;
  const level1 = (db.query("SELECT COUNT(*) as c FROM risk_events WHERE level = 'level1' AND resolved = 0").get() as { c: number }).c;

  const score = Math.max(0, 100 - unresolved * 5 - level1 * 15);

  // Compute per-source-agent risk counts for dimension scoring
  const sourceCounts = db.query(
    `SELECT source,
       COUNT(*) as total,
       SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) as open,
       SUM(CASE WHEN level = 'level1' AND resolved = 0 THEN 1 ELSE 0 END) as critical
     FROM risk_events GROUP BY source`
  ).all() as Array<{ source: string; total: number; open: number; critical: number }>;

  const bySource = new Map<string, { total: number; open: number; critical: number }>();
  for (const row of sourceCounts) bySource.set(row.source, row);

  function dimScore(agentId: string, base: number, threshold: number): { score: number; status: "pass" | "warning" } {
    const data = bySource.get(agentId);
    if (!data) return { score: base, status: base >= threshold ? "pass" : "warning" };
    const s = Math.max(0, base - data.open * 5 - data.critical * 15);
    return { score: s, status: s >= threshold ? "pass" : "warning" };
  }

  // Ad compliance: combine risk events from marketing agent + risky keyword ratio
  const adTotal = (db.query("SELECT COUNT(*) as c FROM wf_ad_keywords").get() as { c: number }).c;
  const adRisky = (db.query("SELECT COUNT(*) as c FROM wf_ad_keywords WHERE ai_tag = 'risky'").get() as { c: number }).c;
  const adDim = dimScore("marketing-001", 94, 85);
  const adCompliancePenalty = adTotal > 0 ? Math.round((adRisky / adTotal) * 10) : 0;
  const adScore = Math.max(0, adDim.score - adCompliancePenalty);

  // Supply chain: from inventory ship_days
  const shipStats = db.query(
    "SELECT AVG(ship_days) as avg_ship, MAX(ship_days) as max_ship FROM wf_inventory"
  ).get() as { avg_ship: number; max_ship: number };
  const supplyDim = dimScore("ops-001", 91, 80);
  const shipPenalty = (shipStats.avg_ship ?? 0) > 30 ? Math.round((shipStats.avg_ship - 30) * 0.5) : 0;
  const supplyScore = Math.max(0, supplyDim.score - shipPenalty);

  function dimStatus(score: number, threshold: number): "pass" | "warning" {
    return score >= threshold ? "pass" : "warning";
  }

  const accountScore = Math.max(0, 92 - level1 * 10);
  const ipDim = dimScore("legal-001", 88, 85);
  const productDim = dimScore("ops-001", 97, 95);

  const dimensions: HealthDimension[] = [
    { label: "数据合规", score: 96, value: "96/100", threshold: "≥90", status: "pass" },
    { label: "知识产权", score: ipDim.score, value: `${ipDim.score}/100`, threshold: "≥85", status: ipDim.status },
    { label: "账户安全", score: accountScore, value: `${accountScore}/100`, threshold: "≥90", status: level1 > 0 ? "warning" : "pass" },
    { label: "广告合规", score: adScore, value: `${adScore}/100`, threshold: "≥85", status: dimStatus(adScore, 85) },
    { label: "产品安全", score: productDim.score, value: `${productDim.score}/100`, threshold: "≥95", status: productDim.score >= 95 ? "pass" : "warning" },
    { label: "供应链", score: supplyScore, value: `${supplyScore}/100`, threshold: "≥80", status: dimStatus(supplyScore, 80) },
  ];

  // Indicators: compute ODR from risk events, rest from DB where possible
  const level1Total = (db.query("SELECT COUNT(*) as c FROM risk_events WHERE level = 'level1'").get() as { c: number }).c;
  const level2Total = (db.query("SELECT COUNT(*) as c FROM risk_events WHERE level = 'level2'").get() as { c: number }).c;
  const ipEvents = (bySource.get("legal-001")?.total ?? 0);

  const indicators: RiskIndicator[] = [
    { name: "ODR", current: `${Math.min(3, level2Total * 0.3).toFixed(1)}%`, threshold: "<1.5%", status: level2Total > 3 ? "warning" : "safe", trend: [0.8, 0.9, 1.0, 1.1, 1.2, 1.2, 1.2] },
    { name: "退货率", current: "3.2%", threshold: "<5%", status: "safe", trend: [4.1, 3.8, 3.5, 3.4, 3.3, 3.2, 3.2] },
    { name: "侵权投诉", current: `${ipEvents}`, threshold: "0", status: ipEvents > 0 ? "danger" : "safe", trend: [0, 0, 0, 0, 0, ipEvents, ipEvents] },
    { name: "政策违规", current: `${level1Total}`, threshold: "0", status: level1Total > 0 ? "danger" : "safe", trend: [0, 0, 0, 0, 0, level1Total, level1Total] },
    { name: "差评率", current: "2.1%", threshold: "<3%", status: "safe", trend: [2.8, 2.5, 2.3, 2.2, 2.1, 2.1, 2.1] },
  ];

  return { score, dimensions, indicators };
}
