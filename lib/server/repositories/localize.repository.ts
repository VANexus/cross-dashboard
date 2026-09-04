/**
 * FlowMind — 视频本地化 Repository
 * 数据访问层：wf_localize_tasks 表（Prisma Client）
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import type { LocalizeTask, LocalizeTaskStatus } from "@/lib/shared/types";
import { parseJsonField } from "./base";

interface LocalizeRow {
  id: string;
  batch_id: string;
  video_path: string;
  target_lang: string;
  source_lang: string;
  enable_tts: number;
  remove_subtitles: number;
  status: string;
  outputs: string;
  error: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

const TERMINAL = new Set(["completed", "failed", "cancelled", "not_found"]);

function rowToTask(r: LocalizeRow): LocalizeTask {
  const status = r.status as LocalizeTaskStatus;
  const started = r.started_at;
  const finished = r.finished_at;
  let durationSeconds: number | null = null;
  if (started && finished) {
    const s = new Date(started.replace(" ", "T")).getTime();
    const e = new Date(finished.replace(" ", "T")).getTime();
    if (!Number.isNaN(s) && !Number.isNaN(e)) durationSeconds = Math.max(0, (e - s) / 1000);
  }
  return {
    id: r.id,
    batchId: r.batch_id,
    videoPath: r.video_path,
    targetLang: r.target_lang,
    sourceLang: r.source_lang,
    enableTts: !!r.enable_tts,
    removeSubtitles: !!r.remove_subtitles,
    status,
    outputs: parseJsonField<Record<string, string>>(r.outputs, {}),
    error: r.error,
    createdAt: r.created_at,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    durationSeconds,
    isTerminal: TERMINAL.has(status),
    isStalled: false,
    updatedAt: r.updated_at,
  };
}

export async function insertTask(task: {
  id: string;
  batchId: string;
  videoPath: string;
  targetLang: string;
  sourceLang: string;
  enableTts: boolean;
  removeSubtitles: boolean;
  status?: string;
}): Promise<void> {
  try {
    await prisma.wf_localize_tasks.create({
      data: {
        id: task.id,
        batch_id: task.batchId,
        video_path: task.videoPath,
        target_lang: task.targetLang,
        source_lang: task.sourceLang,
        enable_tts: task.enableTts ? 1 : 0,
        remove_subtitles: task.removeSubtitles ? 1 : 0,
        status: task.status ?? "queued",
        created_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    // ON CONFLICT (id) DO NOTHING 语义：重复 id 静默忽略
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    throw e;
  }
}

export async function getTasks(): Promise<LocalizeTask[]> {
  const rows = await prisma.wf_localize_tasks.findMany({
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
  });
  return (rows as LocalizeRow[]).map(rowToTask);
}

export async function getTask(id: string): Promise<LocalizeTask | null> {
  const row = await prisma.wf_localize_tasks.findUnique({ where: { id } });
  return row ? rowToTask(row as LocalizeRow) : null;
}

export async function updateTaskStatus(
  id: string,
  data: {
    status?: string;
    outputs?: Record<string, string>;
    error?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  },
): Promise<void> {
  const sets: Prisma.wf_localize_tasksUpdateInput = { updated_at: new Date().toISOString() };
  if (data.status !== undefined) sets["status"] = data.status;
  if (data.outputs !== undefined) sets["outputs"] = JSON.stringify(data.outputs);
  if (data.error !== undefined) sets["error"] = data.error;
  if (data.startedAt !== undefined) sets["started_at"] = data.startedAt;
  if (data.finishedAt !== undefined) sets["finished_at"] = data.finishedAt;
  if (Object.keys(sets).length === 1) return;
  await prisma.wf_localize_tasks.update({ where: { id }, data: sets });
}

export async function getRecentBatches(limit = 10): Promise<Array<{ id: string; count: number; submittedAt: string }>> {
  const rows = await prisma.wf_localize_tasks.findMany({
    where: { batch_id: { not: "" } },
    orderBy: { created_at: "desc" },
    select: { batch_id: true, created_at: true },
  });

  const batchMap = new Map<string, { count: number; submittedAt: string }>();
  for (const r of rows as Array<{ batch_id: string; created_at: string }>) {
    const existing = batchMap.get(r.batch_id);
    if (!existing) {
      batchMap.set(r.batch_id, { count: 1, submittedAt: r.created_at });
    } else {
      existing.count++;
      if (r.created_at > existing.submittedAt) existing.submittedAt = r.created_at;
    }
  }

  const result = Array.from(batchMap.entries())
    .map(([id, v]) => ({ id, count: v.count, submittedAt: v.submittedAt }))
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
    .slice(0, limit);
  return result;
}
