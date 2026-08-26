/**
 * FlowMind — 视频本地化 Repository
 * 数据访问层：wf_localize_tasks 表
 */
import { getDb } from "../db";
import type { LocalizeTask, LocalizeTaskStatus } from "../types";
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
    // naive 时间戳（无时区后缀）按本地时间解析——VL 的 started_at/finished_at 是本地时间。
    // 仅完成态任务计算时长；进行中任务不调 Date.now()（保持 SSR 确定性，兼容 cacheComponents）
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
    enableTts: r.enable_tts === 1,
    removeSubtitles: r.remove_subtitles === 1,
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

export function insertTask(task: {
  id: string;
  batchId: string;
  videoPath: string;
  targetLang: string;
  sourceLang: string;
  enableTts: boolean;
  removeSubtitles: boolean;
  status?: string;
}): void {
  const db = getDb();
  db.run(
    `INSERT OR IGNORE INTO wf_localize_tasks
      (id, batch_id, video_path, target_lang, source_lang, enable_tts, remove_subtitles, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      task.id, task.batchId, task.videoPath, task.targetLang, task.sourceLang,
      task.enableTts ? 1 : 0, task.removeSubtitles ? 1 : 0, task.status ?? "queued",
    ] as unknown[],
  );
}

export function getTasks(): LocalizeTask[] {
  const db = getDb();
  const rows = db.query(
    "SELECT * FROM wf_localize_tasks ORDER BY created_at DESC, rowid DESC",
  ).all() as unknown as LocalizeRow[];
  return rows.map(rowToTask);
}

export function getTask(id: string): LocalizeTask | null {
  const db = getDb();
  const row = db.query("SELECT * FROM wf_localize_tasks WHERE id = ?").get(id) as unknown as LocalizeRow | undefined;
  return row ? rowToTask(row) : null;
}

export function updateTaskStatus(
  id: string,
  data: {
    status?: string;
    outputs?: Record<string, string>;
    error?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  },
): void {
  const db = getDb();
  const sets: string[] = ["updated_at = datetime('now')"];
  const params: unknown[] = [];
  if (data.status !== undefined) { sets.push("status = ?"); params.push(data.status); }
  if (data.outputs !== undefined) { sets.push("outputs = ?"); params.push(JSON.stringify(data.outputs)); }
  if (data.error !== undefined) { sets.push("error = ?"); params.push(data.error); }
  if (data.startedAt !== undefined) { sets.push("started_at = ?"); params.push(data.startedAt); }
  if (data.finishedAt !== undefined) { sets.push("finished_at = ?"); params.push(data.finishedAt); }
  if (sets.length === 1) return;
  params.push(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db.run(`UPDATE wf_localize_tasks SET ${sets.join(", ")} WHERE id = ?`, params as any[]);
}

export function getRecentBatches(limit = 10): Array<{ id: string; count: number; submittedAt: string }> {
  const db = getDb();
  const rows = db.query(
    `SELECT batch_id as id, COUNT(*) as count, MAX(created_at) as submittedAt
     FROM wf_localize_tasks WHERE batch_id != '' GROUP BY batch_id ORDER BY submittedAt DESC LIMIT ?`,
  ).all(limit) as Array<{ id: string; count: number; submittedAt: string }>;
  return rows;
}