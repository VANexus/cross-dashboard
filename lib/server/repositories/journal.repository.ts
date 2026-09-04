import type { JournalEntry } from "@/lib/shared/types";
import { getMongoDb, COLLECTIONS } from "@/lib/server/db/mongo";

/**
 * Agent 轨迹（journal）—— 已从 PG(agent_journal) 迁至 MongoDB 文档型集合。
 *
 * 迁移动机（P1 数据层降负）：Agent 每轮自主循环都会高频写一条轨迹（思考/决策/反射），
 * 属 append-only、按 agent_id 查时间线、无跨表事务——Mongo 完美契合且显著降低 PG 写负载。
 * 对外函数签名与返回值形态与原 PG 实现保持一致，消费方（runtime/evolution/task/agents）零改动。
 */
interface JournalDoc {
  eventId: string;
  agentId: string;
  type: string;
  content: string;
  context: Record<string, unknown>;
  moodAt: string | null;
  createdAt: string;
}

function docToEntry(d: JournalDoc): JournalEntry {
  return {
    id: d.eventId,
    agentId: d.agentId,
    type: d.type as JournalEntry["type"],
    content: d.content,
    context: d.context ?? {},
    moodAt: d.moodAt ?? "",
    createdAt: d.createdAt,
  };
}

export async function addEntry(data: {
  agentId: string;
  type: JournalEntry["type"];
  content: string;
  context?: Record<string, unknown>;
  moodAt?: string;
}): Promise<JournalEntry> {
  const eventId = `jnl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const db = await getMongoDb();
  await db.collection(COLLECTIONS.agentJournal).insertOne({
    eventId,
    agentId: data.agentId,
    type: data.type,
    content: data.content,
    context: data.context ?? {},
    moodAt: data.moodAt ?? null,
    createdAt: now,
  });
  return {
    id: eventId,
    agentId: data.agentId,
    type: data.type,
    content: data.content,
    context: data.context ?? {},
    moodAt: data.moodAt ?? "",
    createdAt: now,
  };
}

export async function getEntries(agentId: string, limit = 50, offset = 0): Promise<JournalEntry[]> {
  const db = await getMongoDb();
  const rows = await db
    .collection<JournalDoc>(COLLECTIONS.agentJournal)
    .find({ agentId })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .toArray();
  return rows.map(docToEntry);
}

export async function getLatestEntry(agentId: string): Promise<JournalEntry | null> {
  const db = await getMongoDb();
  const row = await db
    .collection<JournalDoc>(COLLECTIONS.agentJournal)
    .find({ agentId })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();
  return row.length ? docToEntry(row[0]) : null;
}

export async function getEntryCount(agentId: string): Promise<number> {
  const db = await getMongoDb();
  return db.collection(COLLECTIONS.agentJournal).countDocuments({ agentId });
}

/** 某时刻之后的新增轨迹数（进化引擎的 7 日日志量指标用）。 */
export async function countSince(agentId: string, since: string): Promise<number> {
  const db = await getMongoDb();
  return db
    .collection(COLLECTIONS.agentJournal)
    .countDocuments({ agentId, createdAt: { $gte: since } });
}