/**
 * FlowMind RAK — B2B Settings Service（服务化版 · 2026-09-03）
 *
 * 职责收缩为「业务凭证/登录态」的 KV 存储 + 连通性测试：
 *   - MCP 端点：不再可配置，走集群服务目录（lib/cluster → flowmind-mcp 自动解析）
 *   - LLM / 生图 key：归 LiteLLM 网关与 flowmind-mcp Secret，不落库、不进 UI
 *   - 浏览器 CDP：开发机调试路径，仅 env（BROWSER_DEBUG_URL）
 *   - 保留：渠道会话 Cookie / 阿里 TOP / 推送 webhook / 每日刷新回调
 */
import { prisma } from "../db";
import { flowmindMcpUrl, clusterMode } from "@/lib/cluster";
import type {
  B2BHealthStatus,
  B2BSettings,
  B2BSettingsGroup,
  B2BTestResult,
} from "@/lib/shared/types";

const KV_KEYS: Record<keyof B2BSettings, string> = {
  tiktokSessionCookie: "b2b_tiktok_session_cookie",
  instagramSessionCookie: "b2b_instagram_session_cookie",
  alibabaAppKey: "b2b_alibaba_app_key",
  alibabaAppSecret: "b2b_alibaba_app_secret",
  alibabaSession: "b2b_alibaba_session",
  feishuWebhookUrl: "b2b_feishu_webhook_url",
  wecomWebhookUrl: "b2b_wecom_webhook_url",
  b2bPushFeishuEnabled: "b2b_push_feishu_enabled",
  b2bPushWecomEnabled: "b2b_push_wecom_enabled",
  b2bDailyRefreshUrl: "b2b_daily_refresh_url",
  b2bDailyRefreshToken: "b2b_daily_refresh_token",
};

const ENV_FALLBACK: Record<keyof B2BSettings, string> = {
  tiktokSessionCookie: "TIKTOK_SESSION_COOKIE",
  instagramSessionCookie: "INSTAGRAM_SESSION_COOKIE",
  alibabaAppKey: "ALIBABA_APP_KEY",
  alibabaAppSecret: "ALIBABA_APP_SECRET",
  alibabaSession: "ALIBABA_SESSION",
  feishuWebhookUrl: "FEISHU_WEBHOOK_URL",
  wecomWebhookUrl: "WECOM_WEBHOOK_URL",
  b2bPushFeishuEnabled: "B2B_PUSH_FEISHU_ENABLED",
  b2bPushWecomEnabled: "B2B_PUSH_WECOM_ENABLED",
  b2bDailyRefreshUrl: "B2B_DAILY_REFRESH_URL",
  b2bDailyRefreshToken: "B2B_DAILY_REFRESH_TOKEN",
};

/** 历史遗留密钥类 KV（服务化后不再读取；P1 数据层迁移时随 SQL 清理） */
export const RETIRED_KV_KEYS = [
  "b2b_flowmind_mcp_url",
  "b2b_browser_debug_url",
  "b2b_longcat_api_key",
  "b2b_allin_api_key",
] as const;

export class B2BSettingsService {
  async getSettings(): Promise<B2BSettings> {
    const keys = Object.values(KV_KEYS);
    const rows = await prisma.ai_config.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const result = {} as B2BSettings;
    (Object.keys(KV_KEYS) as Array<keyof B2BSettings>).forEach((k) => {
      const env = process.env[ENV_FALLBACK[k]] ?? "";
      const kv = map[KV_KEYS[k]] ?? "";
      result[k] = kv || env;
    });
    return result;
  }

  async updateSettings(patch: Partial<B2BSettings>): Promise<B2BSettings> {
    const now = new Date().toISOString();
    const entries = Object.entries(patch)
      .filter(([k, v]) => v !== undefined && (KV_KEYS as Record<string, string>)[k] !== undefined)
      .map(([k, v]) => ({
        key: (KV_KEYS as Record<string, string>)[k],
        value: String(v ?? ""),
        updated_at: now,
      }));
    if (entries.length > 0) {
      await Promise.all(entries.map((e) =>
        prisma.ai_config.upsert({
          where: { key: e.key },
          create: { key: e.key, value: e.value, updated_at: e.updated_at },
          update: { value: e.value, updated_at: e.updated_at },
        }),
      ));
    }
    return this.getSettings();
  }

  async checkDatabaseHealth(): Promise<B2BHealthStatus["database"]> {
    const t0 = Date.now();
    try {
      const c = await prisma.wf_image_skills.count();
      return {
        ok: true,
        latencyMs: Date.now() - t0,
        rowsInImageSkills: c,
      };
    } catch (e: unknown) {
      return {
        ok: false,
        latencyMs: Date.now() - t0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async testGroup(group: B2BSettingsGroup, settings: B2BSettings): Promise<B2BTestResult> {
    const t0 = Date.now();
    try {
      switch (group) {
        case "mcp": {
          // 零配置：端点来自集群服务目录（cluster=flowmind-mcp.core-api.svc / dev=本机 8001）
          const base = flowmindMcpUrl().replace(/\/+$/, "");
          const r = await this._fetchProbe(base, {
            method: "POST",
            timeoutMs: 4000,
            headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "flowmind-dashboard", version: "1.0" } } }),
          });
          const ok = r.ok || Boolean(r.reachable && (r.error?.startsWith("406") || r.error?.startsWith("200")));
          return {
            group,
            ok,
            reachable: r.reachable,
            error: ok ? undefined : `${r.error ?? "握手失败"}（集群模式 ${clusterMode()}，端点由服务目录解析）`,
            latencyMs: Date.now() - t0,
          };
        }
        case "channel": {
          // 主路径：开发机浏览器 CDP 直连（真实指纹 + 登录态）；仅 env 提供，集群内不可达属预期
          const cdp = (process.env.BROWSER_DEBUG_URL || "").replace(/\/+$/, "");
          if (cdp) {
            const p = await this._fetchProbe(`${cdp}/json/version`, { method: "GET", timeoutMs: 4000 });
            if (p.ok) {
              return { group, ok: true, reachable: true, latencyMs: Date.now() - t0, error: undefined };
            }
          }
          // 兜底：会话保险库
          const sessions: string[] = [];
          if (settings.tiktokSessionCookie.includes("sessionid=")) sessions.push("TikTok");
          if (settings.instagramSessionCookie.includes("sessionid=")) sessions.push("Instagram");
          if (sessions.length === 0) {
            return {
              group, ok: false, latencyMs: Date.now() - t0,
              error:
                clusterMode() === "cluster"
                  ? "集群内无本机 CDP（预期）；TikHub 主路径无需配置，仅旧自建回退需要开发机会话"
                  : "浏览器 CDP 未连通（用 --remote-debugging-port=9222 重启浏览器并配 BROWSER_DEBUG_URL）且无兜底会话",
            };
          }
          return { group, ok: true, reachable: true, latencyMs: Date.now() - t0, error: undefined };
        }
        case "alibaba": {
          if (!settings.alibabaAppKey || !settings.alibabaAppSecret) {
            return { group, ok: false, error: "阿里 TOP AppKey / Secret 未配置", latencyMs: Date.now() - t0 };
          }
          const qs = new URLSearchParams({
            method: "taobao.time.get",
            app_key: settings.alibabaAppKey,
            timestamp: String(Math.floor(Date.now() / 1000)),
            v: "2.0",
            sign_method: "md5",
            format: "json",
          }).toString();
          const p = await this._fetchProbe(`https://eco.taobao.com/router/rest?${qs}`, { method: "GET", timeoutMs: 5000 });
          return { group, ok: p.ok, reachable: p.reachable, error: p.error, latencyMs: Date.now() - t0 };
        }
        case "webhook": {
          const any = settings.feishuWebhookUrl || settings.wecomWebhookUrl;
          if (!any) return { group, ok: false, error: "飞书 / 企微 webhook 都未配置", latencyMs: Date.now() - t0 };
          return { group, ok: true, reachable: true, latencyMs: Date.now() - t0, error: undefined };
        }
      }
    } catch (e: unknown) {
      return { group, ok: false, error: e instanceof Error ? e.message : String(e), latencyMs: Date.now() - t0 };
    }
  }

  async health(): Promise<B2BHealthStatus> {
    const settings = await this.getSettings();
    const database = await this.checkDatabaseHealth();
    const groups: B2BHealthStatus["groups"] = {
      mcp: { ok: false, reachable: false, error: undefined, latencyMs: 0 },
      channel: { ok: false, reachable: false, error: undefined, latencyMs: 0 },
      alibaba: { ok: false, reachable: false, error: undefined, latencyMs: 0 },
      webhook: { ok: false, reachable: false, error: undefined, latencyMs: 0 },
    };
    const keys = Object.keys(groups) as Array<B2BSettingsGroup>;
    await Promise.all(keys.map(async (k) => { groups[k] = await this.testGroup(k, settings); }));
    return { database, groups };
  }

  private async _fetchProbe(
    url: string,
    opts: { method?: string; headers?: Record<string, string>; timeoutMs?: number; body?: string },
  ): Promise<{ ok: boolean; reachable: boolean; error?: string }> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 5000);
    try {
      const r = await fetch(url, {
        method: opts.method ?? "GET",
        headers: opts.headers,
        body: opts.body,
        signal: ctrl.signal,
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        return {
          ok: false,
          reachable: true,
          error: `${r.status} ${r.statusText}${text ? `: ${text.slice(0, 120)}` : ""}`,
        };
      }
      return { ok: true, reachable: true };
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        return { ok: false, reachable: false, error: `超时 ${opts.timeoutMs ?? 5000}ms` };
      }
      return { ok: false, reachable: false, error: e instanceof Error ? e.message : String(e) };
    } finally {
      clearTimeout(timer);
    }
  }
}
