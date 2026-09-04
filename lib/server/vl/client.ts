/**
 * FlowMind — video-localizer (VL) HTTP 客户端
 *
 * 与 rak-flowmind 的 VLClient（src/flowmind/vl_client.py）语义对齐：
 * - 统一错误分类：environment（网络/连接）/ video（4xx/资源状态）/ transient（5xx，可重试）
 * - 统一超时 / 404 / 5xx 处理
 * - 健康检查 fast-fail
 *
 * 配置走环境变量（对齐 LocalizerConfig 语义，不硬编码）：
 *   VL_API_BASE        默认 http://localhost:8000
 *   VL_API_PREFIX      默认 /api/v1
 *   VL_HTTP_TIMEOUT    默认 30s
 *   VL_HEALTH_TIMEOUT  默认 2s
 */

export type VLErrorCategory = "environment" | "video" | "transient";

export class VLError extends Error {
  category: VLErrorCategory;
  code: string;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, category: VLErrorCategory, details?: Record<string, unknown>) {
    super(message);
    this.name = "VLError";
    this.code = code;
    this.category = category;
    this.details = details;
  }
}

export interface VLConfig {
  apiBase: string;
  apiPrefix: string;
  httpTimeout: number;
  healthTimeout: number;
}

export function getVLConfig(): VLConfig {
  return {
    apiBase: process.env.VL_API_BASE ?? "http://localhost:8000",
    apiPrefix: process.env.VL_API_PREFIX ?? "/api/v1",
    httpTimeout: Number(process.env.VL_HTTP_TIMEOUT ?? 30),
    healthTimeout: Number(process.env.VL_HEALTH_TIMEOUT ?? 2),
  };
}

export interface VLBatchPayload {
  video_paths: string[];
  target_lang: string;
  source_lang: string;
  enable_tts: boolean;
  remove_subtitles: boolean;
  remove_subtitles_strategy?: string;
}

export interface VLBatchResult {
  batch_id: string;
  job_ids: string[];
  message?: string;
}

export interface VLTaskDetail {
  task_id: string;
  status: string;
  source_video?: string | null;
  target_language?: string | null;
  output_dir?: string | null;
  outputs?: Record<string, string>;
  error?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export class VLClient {
  private cfg: VLConfig;

  constructor(cfg?: VLConfig) {
    this.cfg = cfg ?? getVLConfig();
  }

  get baseUrl(): string {
    return `${this.cfg.apiBase.replace(/\/+$/, "")}${this.cfg.apiPrefix}`;
  }

  get apiBase(): string {
    return this.cfg.apiBase;
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  /** 探活：VL 不通抛 VLError（environment/transient/video）。 */
  async healthCheck(): Promise<void> {
    let r: Response;
    try {
      r = await fetch(this.url("/health"), {
        signal: AbortSignal.timeout(this.cfg.healthTimeout * 1000),
      });
    } catch (err) {
      throw new VLError("INTERNAL", "video-localizer 健康检查失败", "environment", {
        url: this.baseUrl,
        cause: err instanceof Error ? err.name : "unknown",
      });
    }
    if (r.status >= 500) {
      throw new VLError("INTERNAL", "健康检查 5xx", "transient", { status_code: r.status });
    }
    if (r.status >= 400) {
      throw new VLError("INTERNAL", "健康检查 4xx", "video", { status_code: r.status });
    }
    if (!r.ok) {
      throw new VLError("INTERNAL", `健康检查失败: ${r.status}`, "transient", { status_code: r.status });
    }
  }

  /** POST /batch 批量提交。 */
  async submitBatch(payload: VLBatchPayload): Promise<VLBatchResult> {
    const body = await this.post("/batch", payload);
    return {
      batch_id: String(body.batch_id ?? ""),
      job_ids: Array.isArray(body.job_ids) ? body.job_ids.map(String) : [],
      message: body.message ? String(body.message) : undefined,
    };
  }

  /** GET /tasks/{id} 任务详情。404 → VLError(video)。 */
  async getTask(taskId: string): Promise<VLTaskDetail> {
    return this.get(`/tasks/${encodeURIComponent(taskId)}`) as unknown as Promise<VLTaskDetail>;
  }

  /** DELETE /tasks/{id} 取消任务。 */
  async cancelTask(taskId: string): Promise<{ message?: string }> {
    return this.delete(`/tasks/${encodeURIComponent(taskId)}`);
  }

  /** 重提：GET 原任务参数 → POST /tasks 单条重提（对齐 localize_retry）。 */
  async retryTask(
    taskId: string,
    overrides?: { sourceLang?: string; enableTts?: boolean; removeSubtitles?: boolean },
  ): Promise<{ task_id: string }> {
    const original = await this.getTask(taskId);
    const sourceVideo = original.source_video;
    if (!sourceVideo) {
      throw new VLError("NOT_FOUND", `Task ${taskId} has no source_video, cannot retry`, "video");
    }
    const payload: Record<string, unknown> = {
      video_path: sourceVideo,
      target_lang: original.target_language || "en",
      // 原任务的 source_lang / TTS / 去字幕设置由调用方（service 持有的本地行）透传，
      // 不再硬编码或恒为 "zh"（修复旧版丢失参数的 bug）
      source_lang: overrides?.sourceLang ?? "zh",
      enable_tts: overrides?.enableTts ?? true,
      remove_subtitles: overrides?.removeSubtitles ?? true,
    };
    const body = await this.post("/tasks", payload);
    return { task_id: String(body.task_id ?? body.job_id ?? "") };
  }

  /** 产物下载 URL（VL 端拼接，不发起请求）。 */
  getDownloadUrl(taskId: string, filename: string): string {
    return `${this.baseUrl}/tasks/${encodeURIComponent(taskId)}/download?file=${encodeURIComponent(filename)}`;
  }

  private async post(path: string, payload: unknown): Promise<Record<string, unknown>> {
    let r: Response;
    try {
      r = await fetch(this.url(path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.cfg.httpTimeout * 1000),
      });
    } catch (err) {
      throw new VLError("INTERNAL", `POST ${path} 失败`, "environment", {
        cause: err instanceof Error ? err.name : "unknown",
      });
    }
    return this.parse(r, path);
  }

  private async get(path: string): Promise<Record<string, unknown>> {
    let r: Response;
    try {
      r = await fetch(this.url(path), {
        signal: AbortSignal.timeout(this.cfg.httpTimeout * 1000),
      });
    } catch (err) {
      throw new VLError("INTERNAL", `GET ${path} 失败`, "environment", {
        cause: err instanceof Error ? err.name : "unknown",
      });
    }
    if (r.status === 404) {
      throw new VLError("NOT_FOUND", `资源不存在: ${path}`, "video");
    }
    return this.parse(r, path);
  }

  private async delete(path: string): Promise<Record<string, unknown>> {
    let r: Response;
    try {
      r = await fetch(this.url(path), {
        method: "DELETE",
        signal: AbortSignal.timeout(this.cfg.httpTimeout * 1000),
      });
    } catch (err) {
      throw new VLError("INTERNAL", `DELETE ${path} 失败`, "environment", {
        cause: err instanceof Error ? err.name : "unknown",
      });
    }
    return this.parse(r, path);
  }

  /** 解析响应：4xx → video；5xx → transient；2xx → JSON。 */
  private async parse(r: Response, path: string): Promise<Record<string, unknown>> {
    if (r.status >= 400 && r.status < 500) {
      let detail: unknown = "";
      try {
        detail = await r.json();
      } catch {
        detail = (await r.text()).slice(0, 200);
      }
      throw new VLError(
        r.status === 400 || r.status === 422 ? "VALIDATION" : "INTERNAL",
        `${r.status} ${path}`,
        "video",
        { status_code: r.status, body: detail },
      );
    }
    if (r.status >= 500) {
      const text = (await r.text()).slice(0, 200);
      throw new VLError("INTERNAL", `5xx ${path}`, "transient", { status_code: r.status, body: text });
    }
    try {
      return (await r.json()) as Record<string, unknown>;
    } catch {
      return { _raw: await r.text() };
    }
  }
}