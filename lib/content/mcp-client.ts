/**
 * FlowMind — flowmind MCP 客户端（Streamable HTTP）
 *
 * 连接 rak-flowmind 的 MCP 服务（flowmind-mcp-http），调用 content_* 技能。
 * Web 端零密钥：所有 AI 逻辑与云密钥都在 flowmind，本客户端只做「调用 + 结构化解析」。
 *
 * 配置走环境变量：
 *   FLOWMIND_MCP_URL   默认 http://127.0.0.1:8001/mcp
 *   FLOWMIND_MCP_TIMEOUT  单次调用超时（ms），默认 30000
 *   FLOWMIND_MCP_MAX_RETRIES  环境错误最大重试次数，默认 2
 *
 * 错误分类（对齐 VLError 语义）：
 *   environment   连接/握手失败（MCP 服务未启动）— 可重试
 *   skill         技能执行失败（SkillResult.ok=false，携带 error.code/message）— 不可重试
 *   timeout       调用超时 — 可重试
 *   unknown       未知结构异常
 *
 * 可靠性特性：
 *   - 连接复用：长连接 + 懒连接，避免重复握手
 *   - 断路器：连续 N 次环境错误后断开，冷却期后尝试半开
 *   - 指数退避重试：仅对 environment/timeout 错误
 *   - 可观测：lastError / stats 暴露运行时状态
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export type ContentMCPErrorCategory = "environment" | "skill" | "timeout" | "unknown";

export class ContentMCPError extends Error {
  category: ContentMCPErrorCategory;
  skillCode?: string;
  retriable: boolean;

  constructor(category: ContentMCPErrorCategory, message: string, skillCode?: string) {
    super(message);
    this.name = "ContentMCPError";
    this.category = category;
    this.skillCode = skillCode;
    // 只有 skill 错误不可重试；environment / timeout / unknown 都可重试
    this.retriable = category !== "skill";
  }
}

export interface ContentMCPConfig {
  url: string;
  timeout: number;
  maxRetries: number;
  circuitBreakerThreshold: number;
  circuitBreakerCooldown: number;
}

export function getMCPConfig(): ContentMCPConfig {
  return {
    url: process.env.FLOWMIND_MCP_URL ?? "http://127.0.0.1:8001/mcp",
    timeout: Number(process.env.FLOWMIND_MCP_TIMEOUT ?? 30000),
    maxRetries: Number(process.env.FLOWMIND_MCP_MAX_RETRIES ?? 2),
    circuitBreakerThreshold: Number(process.env.FLOWMIND_MCP_CB_THRESHOLD ?? 5),
    circuitBreakerCooldown: Number(process.env.FLOWMIND_MCP_CB_COOLDOWN ?? 30000),
  };
}

/** flowmind 技能返回的 SkillResult 信封（对齐 contracts.py）。 */
interface SkillResultEnvelope<T> {
  ok: boolean;
  skill?: string;
  data: T;
  error?: { code?: string; message?: string } | null;
  metrics?: { degraded?: boolean; degradation_reason?: string | null };
}

function isSkillEnvelope(v: unknown): v is SkillResultEnvelope<unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    "ok" in (v as Record<string, unknown>) &&
    "data" in (v as Record<string, unknown>)
  );
}

/** 断路器状态 */
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

/** 运行时统计 */
export interface MCPStats {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  retriedCalls: number;
  circuitOpenCount: number;
  lastError: { message: string; at: number } | null;
  circuitState: CircuitState;
}

export class ContentMCPClient {
  private cfg: ContentMCPConfig;
  private client: Client | null = null;
  private connecting: Promise<Client> | null = null;

  // 断路器状态
  private circuitState: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureAt = 0;
  private halfOpenAttempted = false;

  // 运行时统计
  private stats: MCPStats = {
    totalCalls: 0,
    successCalls: 0,
    failedCalls: 0,
    retriedCalls: 0,
    circuitOpenCount: 0,
    lastError: null,
    circuitState: "CLOSED",
  };

  constructor(cfg?: ContentMCPConfig) {
    this.cfg = cfg ?? getMCPConfig();
  }

  get url(): string {
    return this.cfg.url;
  }

  /** 运行时统计（探活/监控用）。 */
  getStats(): Readonly<MCPStats> {
    return { ...this.stats, circuitState: this.circuitState };
  }

  /** 探活：tools/list 握手。失败抛 ContentMCPError(environment)。 */
  async ping(): Promise<boolean> {
    try {
      await this.listTools();
      return true;
    } catch (err) {
      if (err instanceof ContentMCPError) throw err;
      return false;
    }
  }

  /** 调用 content_* 技能。入参按 flowmind 约定包一层 `inp`。返回技能业务 data。
   *  opts.timeoutMs：单次调用超时覆盖（默认 cfg.timeout）；长任务（如渠道登录）传大值。
   *  opts.noRetry：跳过重试（长任务重试会导致重复弹登录窗）。 */
  async call<T>(tool: string, args: Record<string, unknown>, opts?: { timeoutMs?: number; noRetry?: boolean }): Promise<T> {
    // 断路器检查
    if (this.circuitState === "OPEN") {
      if (this.shouldAttemptReset()) {
        this.circuitState = "HALF_OPEN";
        this.halfOpenAttempted = true;
      } else {
        throw new ContentMCPError(
          "environment",
          `断路器断开中（MCP 服务 ${this.cfg.url} 暂时不可用，请稍后重试）`,
        );
      }
    }

    this.stats.totalCalls++;
    let lastErr: ContentMCPError | null = null;

    const maxAttempts = opts?.noRetry ? 1 : 1 + this.cfg.maxRetries;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        this.stats.retriedCalls++;
        const backoff = this.backoffMs(attempt - 1);
        await sleep(backoff);
      }

      try {
        const result = await this.doCall<T>(tool, args, opts?.timeoutMs);
        this.onSuccess();
        return result;
      } catch (err) {
        lastErr = this.classifyError(err, tool);
        this.onFailure(lastErr);

        // 不可重试的错误直接抛出
        if (!lastErr.retriable) throw lastErr;
      }
    }

    // 重试耗尽
    throw lastErr ?? new ContentMCPError("environment", `${tool}：重试耗尽`);
  }

  /** 列出 MCP 工具名（探活用）。 */
  async listTools(): Promise<string[]> {
    const client = await this.ensureConnected();
    try {
      const res = await client.listTools();
      return res.tools.map((t) => t.name);
    } catch (err) {
      // listTools 失败时断开，下次调用会重连
      this.teardown();
      throw this.classifyError(err, "listTools");
    }
  }

  /** 主动断开连接（进程退出或需要强制重连时调用）。 */
  async disconnect(): Promise<void> {
    this.teardown();
  }

  // ── 内部方法 ──

  private async doCall<T>(tool: string, args: Record<string, unknown>, timeoutMs?: number): Promise<T> {
    const client = await this.ensureConnected();
    try {
      const result = await client.callTool(
        { name: tool, arguments: { inp: args } },
        undefined,
        { timeout: timeoutMs ?? this.cfg.timeout },
      );

      const raw = result.structuredContent ??
        this.parseTextContent(result.content as Array<{ type?: string; text?: string }>);

      if (result.isError) {
        const msg = this.extractErrorMessage(result.content) ?? `${tool}：技能执行返回错误`;
        throw new ContentMCPError("skill", msg);
      }

      if (!isSkillEnvelope(raw)) {
        throw new ContentMCPError("unknown", `技能 ${tool} 返回结构异常`);
      }
      if (!raw.ok) {
        const code = raw.error?.code ?? "INTERNAL";
        const msg = raw.error?.message ?? "技能执行失败";
        throw new ContentMCPError("skill", `${tool}：${msg}`, code);
      }
      return raw.data as T;
    } catch (err) {
      // 会话失效（服务端重启）→ 立即断开，下次调用重建会话
      const cause = err instanceof Error ? err.message : String(err);
      if (cause.includes("Session not found")) {
        this.teardown();
        throw this.classifyError(err, tool);
      }
      // 调用失败时断开，避免脏连接
      if (err instanceof ContentMCPError) throw err;
      this.teardown();
      throw err;
    }
  }

  /** 懒连接：复用已有连接，断开后自动重连。 */
  private async ensureConnected(): Promise<Client> {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;

    this.connecting = this.createConnection();
    try {
      const client = await this.connecting;
      this.client = client;
      return client;
    } finally {
      this.connecting = null;
    }
  }

  private async createConnection(): Promise<Client> {
    const client = new Client(
      { name: "flowmind-web", version: "1.0.0" },
      { capabilities: {} },
    );
    const transport = new StreamableHTTPClientTransport(new URL(this.cfg.url));
    await client.connect(transport);
    return client;
  }

  private teardown(): void {
    if (this.client) {
      this.client.close().catch(() => { /* ignore */ });
      this.client = null;
    }
    this.connecting = null;
  }

  private classifyError(err: unknown, tool: string): ContentMCPError {
    if (err instanceof ContentMCPError) return err;
    const cause = err instanceof Error ? err.message : String(err);

    // 超时检测
    if (cause.includes("timeout") || cause.includes("aborted") || cause.includes("AbortError")) {
      return new ContentMCPError("timeout", `技能 ${tool} 调用超时（${this.cfg.timeout}ms）`);
    }
    return new ContentMCPError("environment", `连接 flowmind MCP 失败（${tool}）：${cause}`);
  }

  private extractErrorMessage(content: unknown): string | null {
    if (!Array.isArray(content)) return null;
    const textBlock = content.find((c) => c && typeof c === "object" && "text" in c);
    if (textBlock && typeof textBlock.text === "string") return textBlock.text;
    return null;
  }

  private parseTextContent(
    content: Array<{ type?: string; text?: string }>,
  ): unknown {
    const block = content.find((c) => c.type === "text" && c.text);
    if (!block?.text) return null;
    try {
      return JSON.parse(block.text);
    } catch {
      return block.text;
    }
  }

  // ── 断路器 ──

  private onSuccess(): void {
    this.stats.successCalls++;
    this.failureCount = 0;
    if (this.circuitState === "HALF_OPEN") {
      this.circuitState = "CLOSED";
      this.halfOpenAttempted = false;
    }
  }

  private onFailure(err: ContentMCPError): void {
    this.stats.failedCalls++;
    this.stats.lastError = { message: err.message, at: Date.now() };

    if (this.circuitState === "HALF_OPEN") {
      // 半开状态下再次失败 → 重新断开
      this.circuitState = "OPEN";
      this.stats.circuitOpenCount++;
      this.lastFailureAt = Date.now();
      this.halfOpenAttempted = false;
      return;
    }

    // CLOSED 状态下累计失败
    if (err.category === "skill") return; // skill 错误不触发断路器
    this.failureCount++;
    if (this.failureCount >= this.cfg.circuitBreakerThreshold) {
      this.circuitState = "OPEN";
      this.stats.circuitOpenCount++;
      this.lastFailureAt = Date.now();
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureAt >= this.cfg.circuitBreakerCooldown;
  }

  private backoffMs(attempt: number): number {
    // 指数退避：1s → 2s → 4s，带 ±25% 抖动
    const base = Math.pow(2, attempt) * 1000;
    const jitter = base * 0.25 * (Math.random() * 2 - 1);
    return Math.round(base + jitter);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
