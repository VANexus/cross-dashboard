/**
 * FlowMind — MongoDB 业务集合操作（记忆历史 / 召回日志 / 进化审计）
 *
 * 全部 append-only（不可变审计）：PG 是关系事实源，Mongo 保存文档型轨迹。
 */
import { getMongoDb, COLLECTIONS } from "./mongo";
import type { Document, UpdateFilter } from "mongodb";

// ── 记忆版本历史 ──────────────────────────────────────────────

export interface MemoryHistoryDoc {
  memoryId: string;
  action: "create" | "update" | "delete";
  /** 变更前快照（create 为 null） */
  before: Record<string, unknown> | null;
  /** 变更后快照（delete 为 null） */
  after: Record<string, unknown> | null;
  version: number;
  at: string;
}

export async function appendMemoryHistory(doc: Omit<MemoryHistoryDoc, "at">): Promise<void> {
  const db = await getMongoDb();
  await db.collection(COLLECTIONS.memoryHistory).insertOne({ ...doc, at: new Date().toISOString() });
}

export async function getMemoryHistory(memoryId: string, limit = 50): Promise<MemoryHistoryDoc[]> {
  const db = await getMongoDb();
  const rows = await db
    .collection(COLLECTIONS.memoryHistory)
    .find({ memoryId })
    .sort({ at: -1 })
    .limit(limit)
    .toArray();
  return rows.map((r) => ({
    memoryId: r.memoryId as string,
    action: r.action as MemoryHistoryDoc["action"],
    before: (r.before ?? null) as Record<string, unknown> | null,
    after: (r.after ?? null) as Record<string, unknown> | null,
    version: (r.version ?? 1) as number,
    at: r.at as string,
  }));
}

// ── 记忆召回日志 ──────────────────────────────────────────────

export interface MemoryRecallDoc {
  memoryId: string;
  agentId: string | null;
  query: string;
  score: number;
  at: string;
}

export async function recordMemoryRecall(doc: Omit<MemoryRecallDoc, "at">): Promise<void> {
  try {
    const db = await getMongoDb();
    await db.collection(COLLECTIONS.memoryRecall).insertOne({ ...doc, at: new Date().toISOString() });
  } catch (e) {
    console.warn("[mongo] recordMemoryRecall failed:", (e as Error).message);
  }
}

/** 最近 N 天召回次数（按记忆聚合，用量统计）。 */
export async function countRecallByMemory(memoryId: string, days = 7): Promise<number> {
  const db = await getMongoDb();
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  return db.collection(COLLECTIONS.memoryRecall).countDocuments({ memoryId, at: { $gte: since } });
}

// ── 进化运行审计 ──────────────────────────────────────────────

export interface EvolutionStageDoc {
  stage: string; // identify / generate / test / review / reuse
  status: "running" | "success" | "failed";
  note: string;
  at: string;
}

export interface EvolutionRunDoc {
  runId: string;
  agentId: string;
  recordId: string;
  source: "manual" | "auto";
  stages: EvolutionStageDoc[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  status: "running" | "success" | "failed";
  startedAt: string;
  finishedAt?: string;
  result?: string;
}

export async function startEvolutionRun(doc: {
  runId: string;
  agentId: string;
  recordId: string;
  source: "manual" | "auto";
}): Promise<void> {
  const db = await getMongoDb();
  await db.collection(COLLECTIONS.evolutionRuns).insertOne({
    ...doc,
    stages: [],
    before: null,
    after: null,
    status: "running",
    startedAt: new Date().toISOString(),
  });
}

export async function appendEvolutionStage(runId: string, stage: Omit<EvolutionStageDoc, "at">): Promise<void> {
  const db = await getMongoDb();
  const update = {
    $push: { stages: { ...stage, at: new Date().toISOString() } },
  } as unknown as UpdateFilter<Document>;
  await db.collection(COLLECTIONS.evolutionRuns).updateOne({ runId }, update);
}

export async function finishEvolutionRun(
  runId: string,
  data: {
    status: "success" | "failed";
    before: unknown;
    after: unknown;
    result?: string;
  },
): Promise<void> {
  const db = await getMongoDb();
  await db.collection(COLLECTIONS.evolutionRuns).updateOne(
    { runId },
    {
      $set: {
        status: data.status,
        before: data.before as Record<string, unknown>,
        after: data.after as Record<string, unknown>,
        result: data.result ?? "",
        finishedAt: new Date().toISOString(),
      },
    },
  );
}

export async function getEvolutionRun(runId: string): Promise<EvolutionRunDoc | null> {
  const db = await getMongoDb();
  const row = await db.collection(COLLECTIONS.evolutionRuns).findOne({ runId });
  if (!row) return null;
  return row as unknown as EvolutionRunDoc;
}
