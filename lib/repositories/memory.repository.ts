/**
 * FlowMind RAK — Memory Repository
 * Data access for memory entries
 */
import { getDb } from "../db";
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

export function getMemoryEntries(filters?: {
  zone?: string;
  type?: string;
  search?: string;
  agentId?: string;
  page?: number;
  pageSize?: number;
}): PaginatedResult<MemoryEntry> {
  let where = "WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.zone) { where += " AND zone = ?"; params.push(filters.zone); }
  if (filters?.type) { where += " AND type = ?"; params.push(filters.type); }
  if (filters?.agentId) { where += " AND agent_id = ?"; params.push(filters.agentId); }
  if (filters?.search) {
    where += " AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)";
    const s = `%${filters.search}%`;
    params.push(s, s, s);
  }

  const result = paginatedQuery<MemoryRow>("memory_entries", where, params, filters?.page ?? 1, filters?.pageSize ?? 20);
  return { items: result.items.map(mapMemory), pagination: result.pagination };
}

export function getMemoryById(id: string): MemoryEntry | null {
  const db = getDb();
  const row = db.query("SELECT * FROM memory_entries WHERE id = ?").get(id) as MemoryRow | null;
  return row ? mapMemory(row) : null;
}

export function createMemory(data: {
  zone: string;
  title: string;
  content: string;
  type: string;
  tags?: string[];
  agentId?: string;
}): MemoryEntry {
  const db = getDb();
  const id = `mem-${Date.now()}`;
  db.run(
    `INSERT INTO memory_entries (id, zone, title, content, type, tags, agent_id, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, data.zone, data.title, data.content, data.type,
    JSON.stringify(data.tags ?? []),
    data.agentId ?? null],
  );
  return getMemoryById(id)!;
}

export function getMemoriesForAgent(agentId: string, limit = 5): MemoryEntry[] {
  const db = getDb();
  const rows = db.query(
    "SELECT * FROM memory_entries WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(agentId, limit) as MemoryRow[];
  return rows.map(mapMemory);
}

export function getGlobalPresets(): MemoryEntry[] {
  const db = getDb();
  const rows = db.query(
    "SELECT * FROM memory_entries WHERE zone = 'preset' AND verified = 1 ORDER BY created_at DESC"
  ).all() as MemoryRow[];
  return rows.map(mapMemory);
}

export function updateMemory(id: string, data: Partial<MemoryEntry>): MemoryEntry | null {
  const db = getDb();
  const sets: string[] = ["updated_at = datetime('now')"];
  const params: unknown[] = [];

  if (data.title !== undefined) { sets.push("title = ?"); params.push(data.title); }
  if (data.content !== undefined) {
    sets.push("content = ?"); params.push(data.content);
    sets.push("version = version + 1"); // auto-increment version on content change
  }
  if (data.type !== undefined) { sets.push("type = ?"); params.push(data.type); }
  if (data.tags !== undefined) { sets.push("tags = ?"); params.push(JSON.stringify(data.tags)); }
  if (data.verified !== undefined) { sets.push("verified = ?"); params.push(data.verified ? 1 : 0); }

  params.push(id);
  db.run(`UPDATE memory_entries SET ${sets.join(", ")} WHERE id = ?`, params as any[]);
  return getMemoryById(id);
}

export function deleteMemory(id: string): boolean {
  const db = getDb();
  const changes = db.run("DELETE FROM memory_entries WHERE id = ?", [id]).changes;
  return changes > 0;
}

export function getMemoryUsage(id: string): MemoryUsageStats | null {
  const db = getDb();
  const row = db.query("SELECT * FROM memory_entries WHERE id = ?").get(id) as MemoryRow | null;
  if (!row) return null;

  const totalMemories = (db.query("SELECT COUNT(*) as c FROM memory_entries").get() as { c: number }).c;

  // Derive workflow associations from tags
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

  // Trend: count memories created per day over last 7 days
  const trendRows = db.query(
    `SELECT DATE(created_at) as day, COUNT(*) as c
     FROM memory_entries
     WHERE created_at >= datetime('now', '-7 days')
     GROUP BY day ORDER BY day`
  ).all() as Array<{ day: string; c: number }>;
  const trend = trendRows.length > 0 ? trendRows.map((r) => r.c) : [totalMemories];

  return {
    memoryId: id,
    count: totalMemories,
    trend,
    created: row.created_at,
    modified: row.updated_at,
    workflows,
  };
}
