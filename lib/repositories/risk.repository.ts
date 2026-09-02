/**
 * FlowMind RAK — Risk Repository
 * Data access for risk events, health, and isolation
 */
import { getSupabase } from "../db";
import type { RiskEvent, HealthDimension, RiskIndicator } from "../types";
import { parseJsonField } from "./base";
import type { Pagination } from "../types";

interface PaginatedResult<T> {
  items: T[];
  pagination: Pagination;
}

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
    resolved: !!row.resolved,
    resolvedAt: row.resolved_at ?? undefined,
    actions: parseJsonField<string[]>(row.actions, []),
  };
}

export async function getRiskEvents(filters?: {
  level?: string;
  resolved?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<RiskEvent>> {
  const sb = getSupabase();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  let query = sb.from("risk_events").select("*", { count: "exact" });
  if (filters?.level) query = query.eq("level", filters.level);
  if (filters?.resolved !== undefined) query = query.eq("resolved", filters.resolved ? 1 : 0);

  const { data, count, error } = await query
    .order("id", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw error;
  const total = count ?? 0;
  const items = (data as RiskRow[]).map(mapRisk);

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getRiskEventById(id: string): Promise<RiskEvent | null> {
  const sb = getSupabase();
  const { data, error } = await sb.from("risk_events").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  const row = data as RiskRow | null;
  return row ? mapRisk(row) : null;
}

export async function createRiskEvent(data: {
  level: string;
  title: string;
  description?: string;
  source?: string;
  actions?: string[];
}): Promise<RiskEvent> {
  const sb = getSupabase();
  const id = `risk-${Date.now()}`;
  const row = {
    id,
    level: data.level,
    title: data.title,
    description: data.description ?? "",
    source: data.source ?? "",
    actions: JSON.stringify(data.actions ?? []),
  };
  const { error } = await sb.from("risk_events").insert(row);
  if (error) throw error;
  return (await getRiskEventById(id))!;
}

export async function updateRiskEvent(id: string, data: { resolved?: boolean; resolvedAt?: string }): Promise<RiskEvent | null> {
  const sb = getSupabase();
  const sets: Record<string, unknown> = {};

  if (data.resolved !== undefined) sets["resolved"] = data.resolved ? 1 : 0;
  if (data.resolvedAt !== undefined) sets["resolved_at"] = data.resolvedAt;
  if (data.resolved && !data.resolvedAt) sets["resolved_at"] = new Date().toISOString();

  if (Object.keys(sets).length === 0) return getRiskEventById(id);

  const { error } = await sb.from("risk_events").update(sets).eq("id", id);
  if (error) throw error;
  return getRiskEventById(id);
}

export async function getIsolationItems(): Promise<{ label: string; desc: string; checked: boolean }[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from("risk_isolation").select("*").order("id", { ascending: true });
  if (error) throw error;
  const rows = data as IsolationRow[];
  return rows.map((r) => ({ label: r.label, desc: r.description, checked: !!r.checked }));
}

export async function updateIsolationItem(index: number, checked: boolean): Promise<boolean> {
  const sb = getSupabase();
  const { data, error: qError } = await sb
    .from("risk_isolation")
    .select("id")
    .order("id", { ascending: true })
    .range(index, index);
  if (qError) throw qError;
  const row = (data as Array<{ id: number }>)[0] ?? null;
  if (!row) return false;
  const { error } = await sb.from("risk_isolation").update({ checked: checked ? 1 : 0 }).eq("id", row.id);
  if (error) throw error;
  return true;
}

export async function getHealthData(): Promise<{
  score: number;
  dimensions: HealthDimension[];
  indicators: RiskIndicator[];
}> {
  const sb = getSupabase();

  const { count: unresolvedCount, error: e1 } = await sb
    .from("risk_events")
    .select("*", { count: "exact", head: true })
    .eq("resolved", 0);
  if (e1) throw e1;
  const unresolved = unresolvedCount ?? 0;

  const { count: level1Count, error: e2 } = await sb
    .from("risk_events")
    .select("*", { count: "exact", head: true })
    .eq("level", "level1")
    .eq("resolved", 0);
  if (e2) throw e2;
  const level1 = level1Count ?? 0;

  const score = Math.max(0, 100 - unresolved * 5 - level1 * 15);

  const bySource = new Map<string, { total: number; open: number; critical: number }>();
  const allSourceData = await sb.from("risk_events").select("source, level, resolved");
  if (allSourceData.error) throw allSourceData.error;
  for (const r of allSourceData.data as Array<{ source: string; level: string; resolved: number }>) {
    const entry = bySource.get(r.source) ?? { total: 0, open: 0, critical: 0 };
    entry.total++;
    if (r.resolved === 0) entry.open++;
    if (r.level === "level1" && r.resolved === 0) entry.critical++;
    bySource.set(r.source, entry);
  }

  function dimScore(agentId: string, base: number, threshold: number): { score: number; status: "pass" | "warning" } {
    const data = bySource.get(agentId);
    if (!data) return { score: base, status: base >= threshold ? "pass" : "warning" };
    const s = Math.max(0, base - data.open * 5 - data.critical * 15);
    return { score: s, status: s >= threshold ? "pass" : "warning" };
  }

  const { count: adTotalCount, error: e4 } = await sb
    .from("wf_ad_keywords")
    .select("*", { count: "exact", head: true });
  if (e4) throw e4;
  const adTotal = adTotalCount ?? 0;

  const { count: adRiskyCount, error: e5 } = await sb
    .from("wf_ad_keywords")
    .select("*", { count: "exact", head: true })
    .eq("ai_tag", "risky");
  if (e5) throw e5;
  const adRisky = adRiskyCount ?? 0;

  const adDim = dimScore("marketing-001", 94, 85);
  const adCompliancePenalty = adTotal > 0 ? Math.round((adRisky / adTotal) * 10) : 0;
  const adScore = Math.max(0, adDim.score - adCompliancePenalty);

  const { data: shipStatsRaw, error: e6 } = await sb.from("wf_inventory").select("ship_days");
  if (e6) throw e6;
  const shipRows = shipStatsRaw as Array<{ ship_days: number }>;
  const shipDays = shipRows.map((r) => r.ship_days).filter((v) => v != null && !isNaN(v));
  const avgShip = shipDays.length > 0 ? shipDays.reduce((a, b) => a + b, 0) / shipDays.length : 0;

  const supplyDim = dimScore("ops-001", 91, 80);
  const shipPenalty = avgShip > 30 ? Math.round((avgShip - 30) * 0.5) : 0;
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

  const { count: level1TotalCount, error: e7 } = await sb
    .from("risk_events")
    .select("*", { count: "exact", head: true })
    .eq("level", "level1");
  if (e7) throw e7;
  const level1Total = level1TotalCount ?? 0;

  const { count: level2TotalCount, error: e8 } = await sb
    .from("risk_events")
    .select("*", { count: "exact", head: true })
    .eq("level", "level2");
  if (e8) throw e8;
  const level2Total = level2TotalCount ?? 0;

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
