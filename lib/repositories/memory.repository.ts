import { getSupabase } from "../db";
import type { MemoryEntry, MemoryUsageStats } from "../types";
import { paginatedQuery, type PaginatedResult, parseJsonField } from "./base";

interface MemoryRow {
  id: string;
  zone: string;
  title: string;
  content: string;
  type: string;
  version: number;
  verified: number;
  tags: string;
  agent_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapMemory(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    zone: row.zone as MemoryEntry["zone"],
    title: row.title,
    content: row.content,
    type: row.type as MemoryEntry["type"],
    version: row.version,
    verified: row.verified === 1,
    tags: parseJsonField<string[]>(row.tags, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getMemoryEntries(filters?: {
  zone?: string;
  type?: string;
  search?: string;
  agentId?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<MemoryEntry>> {
  const result = await paginatedQuery<MemoryRow>(
    "memory_entries",
    (qb) => {
      let q = qb;
      if (filters?.zone) q = q.eq("zone", filters.zone);
      if (filters?.type) q = q.eq("type", filters.type);
      if (filters?.agentId) q = q.eq("agent_id", filters.agentId);
      if (filters?.search) {
        const s = `%${filters.search}%`;
        q = q.or(`title.ilike.${s},content.ilike.${s},tags.ilike.${s}`);
      }
      return q;
    },
    filters?.page ?? 1,
    filters?.pageSize ?? 20,
    { column: "created_at", ascending: false },
  );
  return { items: result.items.map(mapMemory), pagination: result.pagination };
}

export async function getMemoryById(id: string): Promise<MemoryEntry | null> {
  const sb = getSupabase();
  const { data } = await sb.from("memory_entries").select("*").eq("id", id).maybeSingle();
  const row = data as MemoryRow | null;
  return row ? mapMemory(row) : null;
}

export async function createMemory(data: {
  zone: string;
  title: string;
  content: string;
  type: string;
  tags?: string[];
  agentId?: string;
}): Promise<MemoryEntry> {
  const sb = getSupabase();
  const id = `mem-${Date.now()}`;
  const now = new Date().toISOString();
  const row: MemoryRow = {
    id,
    zone: data.zone,
    title: data.title,
    content: data.content,
    type: data.type,
    version: 1,
    verified: 0,
    tags: JSON.stringify(data.tags ?? []),
    agent_id: data.agentId ?? null,
    created_at: now,
    updated_at: now,
  };
  await sb.from("memory_entries").insert(row);
  const entry = await getMemoryById(id);
  if (!entry) throw new Error(`memory_entries 写入后查询失败（${id}）`);
  return entry;
}

export async function getMemoriesForAgent(agentId: string, limit = 5): Promise<MemoryEntry[]> {
  const sb = getSupabase();
  const { data } = await sb
    .from("memory_entries")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as MemoryRow[]).map(mapMemory);
}

export async function getGlobalPresets(): Promise<MemoryEntry[]> {
  const sb = getSupabase();
  const { data } = await sb
    .from("memory_entries")
    .select("*")
    .eq("zone", "preset")
    .eq("verified", 1)
    .order("created_at", { ascending: false });
  return ((data ?? []) as MemoryRow[]).map(mapMemory);
}

export async function updateMemory(id: string, data: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const existing = await getMemoryById(id);
  if (!existing) return null;
  const update: Record<string, unknown> = { updated_at: now };
  if (data.title !== undefined) update.title = data.title;
  if (data.content !== undefined) {
    update.content = data.content;
    update.version = existing.version + 1;
  }
  if (data.type !== undefined) update.type = data.type;
  if (data.tags !== undefined) update.tags = JSON.stringify(data.tags);
  if (data.verified !== undefined) update.verified = data.verified ? 1 : 0;
  await sb.from("memory_entries").update(update).eq("id", id);
  return getMemoryById(id);
}

export async function deleteMemory(id: string): Promise<boolean> {
  const sb = getSupabase();
  const { data } = await sb.from("memory_entries").delete().eq("id", id).select();
  return (data?.length ?? 0) > 0;
}

export async function getMemoryUsage(id: string): Promise<MemoryUsageStats | null> {
  const sb = getSupabase();
  const { data: rowData } = await sb.from("memory_entries").select("*").eq("id", id).maybeSingle();
  const row = rowData as MemoryRow | null;
  if (!row) return null;

  const { count: totalMemoriesCount } = await sb
    .from("memory_entries")
    .select("*", { count: "exact", head: true });
  const totalMemories = totalMemoriesCount ?? 0;

  const tags = parseJsonField<string[]>(row.tags, []);
  const workflowMap: Record<string, string> = {
    "选品": "选品", product: "选品", sourcing: "选品",
    "广告": "广告", ad: "广告", ppc: "广告",
    "Listing": "Listing", listing: "Listing", seo: "Listing",
    "库存": "库存", inventory: "库存", restock: "库存",
    "风控": "风控", risk: "风控", compliance: "风控",
  };
  const workflows = [...new Set(tags.map((t) => workflowMap[t]).filter(Boolean))];
  if (workflows.length === 0) workflows.push("通用");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: trendData } = await sb
    .from("memory_entries")
    .select("created_at")
    .gte("created_at", sevenDaysAgo);

  const dayMap: Record<string, number> = {};
  for (const r of (trendData ?? []) as Array<{ created_at: string }>) {
    const day = r.created_at.slice(0, 10);
    dayMap[day] = (dayMap[day] ?? 0) + 1;
  }
  const sortedDays = Object.keys(dayMap).sort();
  const trend = sortedDays.length > 0 ? sortedDays.map((d) => dayMap[d]) : [totalMemories];

  return {
    memoryId: id,
    count: totalMemories,
    trend,
    created: row.created_at,
    modified: row.updated_at,
    workflows,
  };
}
