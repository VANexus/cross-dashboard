/**
 * FlowMind RAK — B2B Settings Service
 * KV 存储于 ai_config，env fallback；并实现每组 API 的连通性测试。
 */
import { getSupabase } from "../db";
import type {
  B2BHealthStatus,
  B2BSettings,
  B2BSettingsGroup,
  B2BTestResult,
} from "../types";

const KV_KEYS: Record<keyof B2BSettings, string> = {
  flowmindMcpUrl: "b2b_flowmind_mcp_url",
  tiktokSessionCookie: "b2b_tiktok_session_cookie",
  instagramSessionCookie: "b2b_instagram_session_cookie",
  alibabaAppKey: "b2b_alibaba_app_key",
  alibabaAppSecret: "b2b_alibaba_app_secret",
  alibabaSession: "b2b_alibaba_session",
  longcatApiKey: "b2b_longcat_api_key",
  allinApiKey: "b2b_allin_api_key",
  feishuWebhookUrl: "b2b_feishu_webhook_url",
  wecomWebhookUrl: "b2b_wecom_webhook_url",
  b2bPushFeishuEnabled: "b2b_push_feishu_enabled",
  b2bPushWecomEnabled: "b2b_push_wecom_enabled",
  b2bDailyRefreshUrl: "b2b_daily_refresh_url",
  b2bDailyRefreshToken: "b2b_daily_refresh_token",
};

const ENV_FALLBACK: Record<keyof B2BSettings, string> = {
  flowmindMcpUrl: "FLOWMIND_MCP_URL",
  tiktokSessionCookie: "TIKTOK_SESSION_COOKIE",
  instagramSessionCookie: "INSTAGRAM_SESSION_COOKIE",
  alibabaAppKey: "ALIBABA_APP_KEY",
  alibabaAppSecret: "ALIBABA_APP_SECRET",
  alibabaSession: "ALIBABA_SESSION",
  longcatApiKey: "LONGCAT_API_KEY",
  allinApiKey: "ALLIN_API_KEY",
  feishuWebhookUrl: "FEISHU_WEBHOOK_URL",
  wecomWebhookUrl: "WECOM_WEBHOOK_URL",
  b2bPushFeishuEnabled: "B2B_PUSH_FEISHU_ENABLED",
  b2bPushWecomEnabled: "B2B_PUSH_WECOM_ENABLED",
  b2bDailyRefreshUrl: "B2B_DAILY_REFRESH_URL",
  b2bDailyRefreshToken: "B2B_DAILY_REFRESH_TOKEN",
};

export class B2BSettingsService {
  async getSettings(): Promise<B2BSettings> {
    const sb = getSupabase();
    const keys = Object.values(KV_KEYS);
    const { data } = await sb.from("ai_config").select("key, value").in("key", keys);
    const map = Object.fromEntries(
      ((data ?? []) as Array<{ key: string; value: string }>).map((r) => [r.key, r.value]),
    );
    const result = {} as B2BSettings;
    (Object.keys(KV_KEYS) as Array<keyof B2BSettings>).forEach((k) => {
      const env = process.env[ENV_FALLBACK[k]] ?? "";
      const db = map[KV_KEYS[k]] ?? "";
      result[k] = db || env;
    });
    return result;
  }

  async updateSettings(patch: Partial<B2BSettings>): Promise<B2BSettings> {
    const sb = getSupabase();
    const now = new Date().toISOString();
    const entries = Object.entries(patch)
      .filter(([k, v]) => v !== undefined && (KV_KEYS as Record<string, string>)[k] !== undefined)
      .map(([k, v]) => ({
        key: (KV_KEYS as Record<string, string>)[k],
        value: String(v ?? ""),
        updated_at: now,
      }));
    if (entries.length > 0) {
      await sb.from("ai_config").upsert(entries, { onConflict: "key" });
    }
    return this.getSettings();
  }

  async checkSupabaseHealth(): Promise<B2BHealthStatus["supabase"]> {
    const sb = getSupabase();
    const t0 = Date.now();
    try {
      const { count, error } = await sb
        .from("wf_image_skills")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return {
        ok: true,
        latencyMs: Date.now() - t0,
        rowsInImageSkills: count ?? 0,
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
          const base = (settings.flowmindMcpUrl || "http://127.0.0.1:8001/mcp").replace(/\/+$/, "");
          const r = await this._fetchProbe(base, {
            method: "POST",
            timeoutMs: 4000,
            headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "flowmind-dashboard", version: "1.0" } } }),
          });
          return {
            group,
            ok: r.ok || Boolean(r.reachable && (r.error?.startsWith("406") || r.error?.startsWith("200"))),
            reachable: r.reachable,
            error: r.ok ? undefined : r.error,
            latencyMs: Date.now() - t0,
          };
        }
        case "channel": {
          const sessions: string[] = [];
          if (settings.tiktokSessionCookie.includes("sessionid=")) sessions.push("TikTok");
          if (settings.instagramSessionCookie.includes("sessionid=")) sessions.push("Instagram");
          if (sessions.length === 0) {
            return { group, ok: false, error: "尚未完成任何平台登录（点击对应平台的「站内登录」按钮）", latencyMs: Date.now() - t0 };
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
        case "longcat": {
          if (!settings.longcatApiKey) return { group, ok: false, error: "LongCat API Key 未配置", latencyMs: Date.now() - t0 };
          const p = await this._fetchProbe("https://api.longcat.chat/anthropic/v1/models", {
            method: "GET",
            timeoutMs: 6000,
            headers: { "x-api-key": settings.longcatApiKey, Authorization: `Bearer ${settings.longcatApiKey}` },
          });
          return { group, ok: p.ok, reachable: p.reachable, error: p.error, latencyMs: Date.now() - t0 };
        }
        case "allin": {
          if (!settings.allinApiKey) return { group, ok: false, error: "AllIn API Key 未配置", latencyMs: Date.now() - t0 };
          const p = await this._fetchProbe("https://allin-api.com/v1/user/balance", {
            method: "GET",
            timeoutMs: 6000,
            headers: { Authorization: `Bearer ${settings.allinApiKey}` },
          });
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
    const supabase = await this.checkSupabaseHealth();
    const groups: B2BHealthStatus["groups"] = {
      mcp: { ok: false, reachable: false, error: undefined, latencyMs: 0 },
      channel: { ok: false, reachable: false, error: undefined, latencyMs: 0 },
      alibaba: { ok: false, reachable: false, error: undefined, latencyMs: 0 },
      longcat: { ok: false, reachable: false, error: undefined, latencyMs: 0 },
      allin: { ok: false, reachable: false, error: undefined, latencyMs: 0 },
      webhook: { ok: false, reachable: false, error: undefined, latencyMs: 0 },
    };
    const keys = Object.keys(groups) as Array<B2BSettingsGroup>;
    await Promise.all(keys.map(async (k) => { groups[k] = await this.testGroup(k, settings); }));
    return { supabase, groups };
  }

  private async _fetch(
    url: string,
    opts: { method?: string; headers?: Record<string, string>; timeoutMs?: number; body?: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const p = await this._fetchProbe(url, opts);
    return { ok: p.ok, error: p.error };
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
