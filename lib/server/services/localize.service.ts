/**
 * FlowMind — 视频本地化 Service
 *
 * 业务逻辑层：直连 video-localizer（VL）后端，语义对齐 rak-flowmind 的 5 个 localize_* 技能：
 * - submitBatch  ↔ localize_batch（扩展名预检 / 成本档位 / 批量超额警告）
 * - getTasks     ↔ localize_status（并发轮询 / 卡住判定）
 * - cancelTask   ↔ localize_cancel
 * - retryTask    ↔ localize_retry
 * - getDownloadUrl ↔ localize_download
 *
 * 所有 VL 失败按 category 结构化返回（不抛裸异常），对齐 degraded 契约。
 */
import * as repo from "../repositories/localize.repository";
import { VLClient, VLError, getVLConfig } from "../vl/client";
import type {
  LocalizeBatchReport, LocalizeHealth, LocalizeTask,
} from "@/lib/shared/types";

const ALLOWED_EXTENSIONS = [".mp4"];
const MAX_VIDEOS_PER_BATCH = 100;
const COST_LOW_MAX = 20;
const COST_HIGH_MIN = 100;
const POLL_MAX_CONCURRENCY = 8;
const STALL_THRESHOLD_SECONDS = 600;

const TERMINAL = new Set(["completed", "failed", "cancelled", "not_found"]);

function isDemoTask(task: LocalizeTask): boolean {
  return task.id.startsWith("lt-demo-") || task.batchId.startsWith("batch-demo-");
}

function splitPaths(videoPaths: string[]): { accepted: string[]; rejected: string[] } {
  const accepted: string[] = [];
  const rejected: string[] = [];
  for (const p of videoPaths) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      accepted.push(trimmed);
      continue;
    }
    const ext = trimmed.slice(trimmed.lastIndexOf(".")).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) accepted.push(trimmed);
    else rejected.push(trimmed);
  }
  return { accepted, rejected };
}

function costBand(n: number): "低" | "中" | "高" {
  if (n <= COST_LOW_MAX) return "低";
  if (n >= COST_HIGH_MIN) return "高";
  return "中";
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<Array<{ status: "fulfilled"; value: R } | { status: "rejected"; reason: unknown }>> {
  const results: Array<{ status: "fulfilled"; value: R } | { status: "rejected"; reason: unknown }> = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export class LocalizeService {
  private client = new VLClient();

  /** VL 健康检查 + 延迟。失败不抛，返回 ok=false。 */
  async getHealth(): Promise<LocalizeHealth> {
    const cfg = getVLConfig();
    const start = Date.now();
    try {
      await this.client.healthCheck();
      return { ok: true, latencyMs: Date.now() - start, apiBase: cfg.apiBase };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        apiBase: cfg.apiBase,
        error: err instanceof VLError ? err.category : "unknown",
      };
    }
  }

  /** 批量提交：预检 → VL /batch → 落库 → 报告。 */
  async submitBatch(input: {
    videoPaths: string[];
    targetLang?: string;
    sourceLang?: string;
    enableTts?: boolean;
    removeSubtitles?: boolean;
  }): Promise<LocalizeBatchReport> {
    const { accepted, rejected } = splitPaths(input.videoPaths);
    const targetLang = input.targetLang || "en";
    const sourceLang = input.sourceLang || "zh";
    const enableTts = input.enableTts ?? true;
    const removeSubtitles = input.removeSubtitles ?? true;

    if (accepted.length === 0) {
      return {
        batchId: "", batchIds: [], jobIds: [],
        submittedCount: 0, rejectedCount: rejected.length, rejectedPaths: rejected,
        costBand: "低", ttsRecommended: enableTts, batchSizeWarning: false,
        apiMessage: "全部视频因扩展名被拒（允许：.mp4 或 URL）",
        failureCategory: "video", retriable: false,
        warning: "全部视频因扩展名被拒（允许：.mp4 或 URL）",
      };
    }

    const band = costBand(accepted.length);
    const batchSizeWarning = accepted.length > MAX_VIDEOS_PER_BATCH;

    try {
      const result = await this.client.submitBatch({
        video_paths: accepted,
        target_lang: targetLang,
        source_lang: sourceLang,
        enable_tts: enableTts,
        remove_subtitles: removeSubtitles,
        remove_subtitles_strategy: "ocr_erase_redraw",
      });

      const jobIds = result.job_ids;
      jobIds.forEach((jobId, i) => {
        repo.insertTask({
          id: jobId,
          batchId: result.batch_id,
          videoPath: accepted[i] ?? accepted[0],
          targetLang,
          sourceLang,
          enableTts,
          removeSubtitles,
          status: "queued",
        }).catch(console.error);
      });

      return {
        batchId: result.batch_id,
        batchIds: [result.batch_id],
        jobIds,
        submittedCount: accepted.length,
        rejectedCount: rejected.length,
        rejectedPaths: rejected,
        costBand: band,
        ttsRecommended: enableTts,
        batchSizeWarning,
        apiMessage: result.message ?? "",
      };
    } catch (err) {
      const category = err instanceof VLError ? err.category : "unknown";
      return {
        batchId: "", batchIds: [], jobIds: [],
        submittedCount: 0, rejectedCount: rejected.length, rejectedPaths: rejected,
        costBand: band, ttsRecommended: enableTts, batchSizeWarning,
        apiMessage: "video-localizer 提交失败",
        failureCategory: category,
        retriable: category === "transient",
        warning: `VL 提交失败（${category}），未提交任何任务`,
      };
    }
  }

  /** 任务列表：读本地库；VL 可达时刷新真实任务实时状态（并发上限 8）。 */
  async getTasks(): Promise<LocalizeTask[]> {
    const tasks = await repo.getTasks();
    const realTasks = tasks.filter((t) => !isDemoTask(t));
    if (realTasks.length === 0) return tasks;

    try {
      await this.client.healthCheck();
    } catch {
      return tasks;
    }

    const results = await mapWithConcurrency(realTasks, POLL_MAX_CONCURRENCY, (t) => this.client.getTask(t.id));
    results.forEach((res, i) => {
      const task = realTasks[i];
      if (res.status === "fulfilled") {
        const detail = res.value;
        repo.updateTaskStatus(task.id, {
          status: detail.status,
          outputs: detail.outputs ?? {},
          error: detail.error ?? null,
          startedAt: detail.started_at ?? null,
          finishedAt: detail.finished_at ?? null,
        }).catch(console.error);
      } else if (res.reason instanceof VLError && res.reason.code === "NOT_FOUND") {
        repo.updateTaskStatus(task.id, { status: "not_found" }).catch(console.error);
      }
    });

    return await repo.getTasks();
  }

  /** 单任务详情：本地 + VL 实时刷新（demo 任务不刷新）。 */
  async getTask(id: string): Promise<LocalizeTask | null> {
    const task = await repo.getTask(id);
    if (!task) return null;
    if (isDemoTask(task)) return task;

    try {
      const detail = await this.client.getTask(id);
      repo.updateTaskStatus(id, {
        status: detail.status,
        outputs: detail.outputs ?? {},
        error: detail.error ?? null,
        startedAt: detail.started_at ?? null,
        finishedAt: detail.finished_at ?? null,
      }).catch(console.error);
    } catch (err) {
      if (err instanceof VLError && err.code === "NOT_FOUND") {
        repo.updateTaskStatus(id, { status: "not_found" }).catch(console.error);
      }
    }
    return await repo.getTask(id);
  }

  /** 取消任务。 */
  async cancelTask(id: string): Promise<{
    cancelled: boolean;
    message: string;
    failureCategory?: string;
    retriable?: boolean;
    warning?: string;
  }> {
    try {
      const body = await this.client.cancelTask(id);
      repo.updateTaskStatus(id, { status: "cancelled" }).catch(console.error);
      return { cancelled: true, message: body.message ?? "已请求取消任务" };
    } catch (err) {
      const category = err instanceof VLError ? err.category : "unknown";
      return {
        cancelled: false,
        message: `VL 调用失败（${category}）`,
        failureCategory: category,
        retriable: category === "transient",
        warning: `取消失败（${category}）`,
      };
    }
  }

  /** 重提任务：VL 重提后把新任务落库。 */
  async retryTask(id: string): Promise<{
    originalTaskId: string;
    newTaskId: string;
    failureCategory?: string;
    retriable?: boolean;
    message?: string;
  }> {
    const original = await repo.getTask(id);
    try {
      const result = await this.client.retryTask(id, {
        sourceLang: original?.sourceLang,
        enableTts: original?.enableTts,
        removeSubtitles: original?.removeSubtitles,
      });
      const newTaskId = result.task_id;
      if (newTaskId && original) {
        repo.insertTask({
          id: newTaskId,
          batchId: original.batchId,
          videoPath: original.videoPath,
          targetLang: original.targetLang,
          sourceLang: original.sourceLang,
          enableTts: original.enableTts,
          removeSubtitles: original.removeSubtitles,
          status: "queued",
        }).catch(console.error);
      }
      return { originalTaskId: id, newTaskId };
    } catch (err) {
      const category = err instanceof VLError ? err.category : "unknown";
      return {
        originalTaskId: id,
        newTaskId: "",
        failureCategory: category,
        retriable: category === "transient",
        message: `重提失败（${category}）`,
      };
    }
  }

  /** 产物下载 URL（VL 端拼接）。 */
  getDownloadUrl(id: string, filename: string): string {
    return this.client.getDownloadUrl(id, filename);
  }

  /** 任务是否卡住（running 且超过阈值）。 */
  isStalled(task: LocalizeTask): boolean {
    if (task.status !== "running" || !task.startedAt) return false;
    const started = new Date(task.startedAt.replace(" ", "T")).getTime();
    if (Number.isNaN(started)) return false;
    return (Date.now() - started) / 1000 > STALL_THRESHOLD_SECONDS;
  }

  /** 终态判定（供 UI 使用）。 */
  isTerminal(status: string): boolean {
    return TERMINAL.has(status);
  }
}
