/**
 * FlowMind — 技能发现 REST 客户端（浏览器 + SSR 安全）
 *
 * 通过 flowmind REST API 在运行时拉取技能清单，替代硬编码技能列表。
 * 仅依赖全局 fetch，无新增依赖；Node 18+ / 浏览器均可运行。
 *
 * 配置走环境变量：
 *   NEXT_PUBLIC_FLOWMIND_URL  base URL，默认 http://127.0.0.1:8001
 *   FLOWMIND_SKILL_TIMEOUT    单次调用超时（ms），默认 10000
 *   FLOWMIND_SKILL_CACHE_TTL  内存缓存 TTL（ms），默认 60000
 *   FLOWMIND_SKILL_CB_THRESHOLD   断路器断开阈值（连续失败次数），默认 5
 *   FLOWMIND_SKILL_CB_COOLDOWN    断路器冷却期（ms），默认 30000
 *
 * 可靠性特性：
 *   - 内存缓存：按方法维度 cacheKey，TTL 内直接命中，避免重复请求
 *   - 断路器：连续 N 次环境错误后断开，冷却期后半开探测
 *   - 可观测：getStats() 暴露 circuitState + 调用计数
 *
 * 错误分类：
 *   environment   连接/网络失败（服务不可达）— 可触发断路器
 *   timeout       请求超时 — 可触发断路器
 *   not_found    404（getSkill 专用，携带 notFound 标记与 available 列表）
 *   unknown       非预期响应结构
 */
import {
  getFlowmindUrl,
  type DiscoveredSkill,
  type SkillHealth,
  type SkillManifest,
} from "./types";

// ── 错误类型 ──

/** 发现客户端错误分类 */
export type SkillDiscoveryErrorCategory = "environment" | "timeout" | "not_found" | "unknown";

/** 技能发现错误（getSkill 404 时 notFound=true，并携带可用技能 id 列表） */
export class SkillDiscoveryError extends Error {
  category: SkillDiscoveryErrorCategory;
  notFound: boolean;
  /** 404 时后端返回的可用技能 id 列表 */
  available: string[];

  constructor(
    category: SkillDiscoveryErrorCategory,
    message: string,
    opts: { notFound?: boolean; available?: string[] } = {},
  ) {
    super(message);
    this.name = "SkillDiscoveryError";
    this.category = category;
    this.notFound = opts.notFound ?? false;
    this.available = opts.available ?? [];
  }
}

// ── 配置 ──

export interface SkillDiscoveryConfig {
  baseUrl: string;
  timeout: number;
  cacheTtl: number;
  circuitBreakerThreshold: number;
  circuitBreakerCooldown: number;
}

export function getSkillDiscoveryConfig(): SkillDiscoveryConfig {
  return {
    baseUrl: getFlowmindUrl(),
    timeout: Number(process.env.FLOWMIND_SKILL_TIMEOUT ?? 10000),
    cacheTtl: Number(process.env.FLOWMIND_SKILL_CACHE_TTL ?? 60000),
    circuitBreakerThreshold: Number(process.env.FLOWMIND_SKILL_CB_THRESHOLD ?? 5),
    circuitBreakerCooldown: Number(process.env.FLOWMIND_SKILL_CB_COOLDOWN ?? 30000),
  };
}

// ── 断路器状态 ──

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

/** 运行时统计（对齐 MCPStats 语义） */
export interface SkillDiscoveryStats {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  cachedCalls: number;
  circuitOpenCount: number;
  lastError: { message: string; at: number } | null;
  circuitState: CircuitState;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}


/** 技能发现 REST 客户端 */
export class SkillDiscoveryClient {
  private cfg: SkillDiscoveryConfig;

  // 内存缓存
  private cache = new Map<string, CacheEntry<unknown>>();

  // 断路器状态
  private circuitState: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureAt = 0;

  // 运行时统计
  private stats: SkillDiscoveryStats = {
    totalCalls: 0,
    successCalls: 0,
    failedCalls: 0,
    cachedCalls: 0,
    circuitOpenCount: 0,
    lastError: null,
    circuitState: "CLOSED",
  };

  constructor(cfg?: SkillDiscoveryConfig) {
    this.cfg = cfg ?? getSkillDiscoveryConfig();
  }

  get url(): string {
    return this.cfg.baseUrl;
  }

  /** 运行时统计（探活/监控用）。 */
  getStats(): Readonly<SkillDiscoveryStats> {
    return { ...this.stats, circuitState: this.circuitState };
  }

  /** 获取技能清单（带缓存与断路器） */
  async getManifest(): Promise<SkillManifest> {
    return this.getCached<SkillManifest>("manifest", () =>
      this.request<SkillManifest>("/api/v1/manifest"),
    );
  }

  /** 获取单个技能（404 抛 SkillDiscoveryError(notFound=true)） */
  async getSkill(id: string): Promise<DiscoveredSkill> {
    const entry = this.readCache<DiscoveredSkill>(`skill:${id}`);
    if (entry) return entry;

    try {
      const skill = await this.request<DiscoveredSkill>(`/api/v1/manifest/${encodeURIComponent(id)}`);
      this.writeCache(`skill:${id}`, skill);
      return skill;
    } catch (err) {
      // 404 透传为 notFound 错误
      if (err instanceof SkillDiscoveryError && err.notFound) throw err;
      throw err;
    }
  }

  /** 健康检查 */
  async health(): Promise<SkillHealth> {
    return this.getCached<SkillHealth>("health", () =>
      this.request<SkillHealth>("/api/v1/health"),
    );
  }

  /** 清空缓存（用于强制刷新） */
  clearCache(): void {
    this.cache.clear();
  }

  // ── 内部方法：缓存 ──

  private readCache<T>(key: string): T | null {
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      this.stats.cachedCalls++;
      return hit.value as T;
    }
    if (hit) this.cache.delete(key);
    return null;
  }

  private writeCache<T>(key: string, value: T): void {
    this.cache.set(key, { value, expiresAt: Date.now() + this.cfg.cacheTtl });
  }

  private async getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const hit = this.readCache<T>(key);
    if (hit) return hit;
    const value = await fetcher();
    this.writeCache(key, value);
    return value;
  }

  // ── 内部方法：断路器 + 请求 ──

  private async request<T>(path: string): Promise<T> {
    // 断路器检查
    if (this.circuitState === "OPEN") {
      if (this.shouldAttemptReset()) {
        this.circuitState = "HALF_OPEN";
      } else {
        throw new SkillDiscoveryError(
          "environment",
          `技能发现服务断开中（${this.cfg.baseUrl} 暂时不可用，请稍后重试）`,
        );
      }
    }

    this.stats.totalCalls++;

    try {
      const result = await this.doFetch<T>(path);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      throw err;
    }
  }

  private async doFetch<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeout);

    try {
      const res = await fetch(`${this.cfg.baseUrl}${path}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (res.status === 404) {
        // 尝试解析后端 { error, available } 结构
        let available: string[] = [];
        let message = `技能未找到（${path}）`;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 404 响应结构由后端契约决定
          const body = (await res.json()) as any;
          if (body && typeof body === "object") {
            if (Array.isArray(body.available)) available = body.available.map(String);
            if (typeof body.error === "string") message = body.error;
          }
        } catch {
          // 响应体非 JSON，使用默认 message
        }
        throw new SkillDiscoveryError("not_found", message, {
          notFound: true,
          available,
        });
      }

      if (!res.ok) {
        throw new SkillDiscoveryError(
          "environment",
          `技能发现请求失败（${res.status} ${res.statusText}）`,
        );
      }

      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof SkillDiscoveryError) throw err;
      throw this.classifyError(err, path);
    } finally {
      clearTimeout(timer);
    }
  }

  private classifyError(err: unknown, path: string): SkillDiscoveryError {
    const cause = err instanceof Error ? err.message : String(err);
    if (err instanceof Error && err.name === "AbortError") {
      return new SkillDiscoveryError("timeout", `技能发现请求超时（${this.cfg.timeout}ms）`);
    }
    if (cause.includes("timeout") || cause.includes("aborted")) {
      return new SkillDiscoveryError("timeout", `技能发现请求超时（${this.cfg.timeout}ms）`);
    }
    return new SkillDiscoveryError("environment", `连接技能发现服务失败（${path}）：${cause}`);
  }

  // ── 断路器 ──

  private onSuccess(): void {
    this.stats.successCalls++;
    this.failureCount = 0;
    if (this.circuitState === "HALF_OPEN") {
      this.circuitState = "CLOSED";
    }
  }

  private onFailure(err: unknown): void {
    this.stats.failedCalls++;
    const message = err instanceof Error ? err.message : String(err);
    this.stats.lastError = { message, at: Date.now() };

    if (this.circuitState === "HALF_OPEN") {
      this.circuitState = "OPEN";
      this.stats.circuitOpenCount++;
      this.lastFailureAt = Date.now();
      return;
    }

    // not_found 属于业务错误，不触发断路器
    if (err instanceof SkillDiscoveryError && err.category === "not_found") return;

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
}
