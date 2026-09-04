import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import type { MemoryEntry, MemoryUsageStats } from "@/lib/shared/types";
import { type PaginatedResult, parseJsonField } from "./base";

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
    verified: !!row.verified,
    tags: parseJsonField<string[]>(row.tags, []),
    agentId: row.agent_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 全量记忆（重建索引用）。 */
export async function getAllMemoryEntries(): Promise<MemoryEntry[]> {
  const rows = await prisma.memory_entries.findMany({ orderBy: { created_at: "asc" } });
  return (rows as MemoryRow[]).map(mapMemory);
}

export async function getMemoryEntries(filters?: {
  zone?: string;
  type?: string;
  search?: string;
  agentId?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<MemoryEntry>> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const where: Prisma.memory_entriesWhereInput = {};
  if (filters?.zone) where.zone = filters.zone;
  if (filters?.type) where.type = filters.type;
  if (filters?.agentId) where.agent_id = filters.agentId;
  if (filters?.search) {
    const contains = { mode: "insensitive" as const, contains: filters.search };
    where.OR = [{ title: contains }, { content: contains }, { tags: contains }];
  }

  const [total, rows] = await Promise.all([
    prisma.memory_entries.count({ where }),
    prisma.memory_entries.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: pageSize,
      skip: offset,
    }),
  ]);

  return {
    items: (rows as MemoryRow[]).map(mapMemory),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getMemoryById(id: string): Promise<MemoryEntry | null> {
  const row = await prisma.memory_entries.findUnique({ where: { id } });
  return row ? mapMemory(row as MemoryRow) : null;
}

export async function createMemory(data: {
  zone: string;
  title: string;
  content: string;
  type: string;
  tags?: string[];
  agentId?: string;
}): Promise<MemoryEntry> {
  const id = `mem-${Date.now()}`;
  const now = new Date().toISOString();
  const row = await prisma.memory_entries.create({
    data: {
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
    },
  });
  if (!row) throw new Error(`memory_entries 写入后查询失败（${id}）`);
  return mapMemory(row as MemoryRow);
}

export async function getMemoriesForAgent(agentId: string, limit = 5): Promise<MemoryEntry[]> {
  const rows = await prisma.memory_entries.findMany({
    where: { agent_id: agentId },
    orderBy: { created_at: "desc" },
    take: limit,
  });
  return (rows as MemoryRow[]).map(mapMemory);
}

export async function getGlobalPresets(): Promise<MemoryEntry[]> {
  const rows = await prisma.memory_entries.findMany({
    where: { zone: "preset", verified: 1 },
    orderBy: { created_at: "desc" },
  });
  return (rows as MemoryRow[]).map(mapMemory);
}

export async function updateMemory(id: string, data: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
  const now = new Date().toISOString();
  const existing = await getMemoryById(id);
  if (!existing) return null;
  const update: Prisma.memory_entriesUpdateInput = { updated_at: now };
  if (data.title !== undefined) update.title = data.title;
  if (data.content !== undefined) {
    update.content = data.content;
    update.version = existing.version + 1;
  }
  if (data.type !== undefined) update.type = data.type;
  if (data.tags !== undefined) update.tags = JSON.stringify(data.tags);
  if (data.verified !== undefined) update.verified = data.verified ? 1 : 0;
  await prisma.memory_entries.update({ where: { id }, data: update });
  return getMemoryById(id);
}

export async function deleteMemory(id: string): Promise<boolean> {
  try {
    const { count } = await prisma.memory_entries.deleteMany({ where: { id } });
    return count > 0;
  } catch {
    return false;
  }
}

export async function getMemoryUsage(id: string): Promise<MemoryUsageStats | null> {
  const row = await prisma.memory_entries.findUnique({ where: { id } });
  if (!row) return null;
  const r = row as MemoryRow;

  const totalMemories = await prisma.memory_entries.count();

  const tags = parseJsonField<string[]>(r.tags, []);
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
  const trendData = await prisma.memory_entries.findMany({
    where: { created_at: { gte: sevenDaysAgo } },
    select: { created_at: true },
  });

  const dayMap: Record<string, number> = {};
  for (const t of trendData as Array<{ created_at: string }>) {
    const day = t.created_at.slice(0, 10);
    dayMap[day] = (dayMap[day] ?? 0) + 1;
  }
  const sortedDays = Object.keys(dayMap).sort();
  const trend = sortedDays.length > 0 ? sortedDays.map((d) => dayMap[d]) : [totalMemories];

  return {
    memoryId: id,
    count: totalMemories,
    trend,
    created: r.created_at,
    modified: r.updated_at,
    workflows,
  };
}
