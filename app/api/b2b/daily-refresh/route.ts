import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, methodNotAllowed } from "@/lib/api-response";
import { B2BService } from "@/lib/services";
import { B2BSettingsService } from "@/lib/services/b2b-settings.service";
import { getSupabase } from "@/lib/db";
import type { TrendPlatform } from "@/lib/types";

const b2b = new B2BService();
const settingsService = new B2BSettingsService();

const PLATFORMS: TrendPlatform[] = ["tiktok", "instagram", "alibaba"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * POST /api/b2b/daily-refresh — 每日定时任务入口（pg_cron → pg_net 回调 / 手动触发）。
 *
 * 鉴权：请求头 x-refresh-token 或 body.token 必须等于 ai_config b2b_daily_refresh_token（未配置 → 401）。
 * 幂等：ai_config b2b_daily_refresh_last_run = 今日 → 直接返回已执行。
 * 流程：三平台 fetchKeywordTrends（真实 MCP + 落库）→ b2b_daily_digest（摘要 + 按开关推送）。
 */
export const POST = withDb(async (request: NextRequest) => {
  const settings = await settingsService.getSettings();
  const expectedToken = settings.b2bDailyRefreshToken?.trim();
  let bodyToken = "";
  try {
    const body = (await request.json()) as { token?: unknown } | null;
    bodyToken = typeof body?.token === "string" ? body.token : "";
  } catch {
    // pg_cron / 无 body 场景，仅靠请求头
  }
  const provided = request.headers.get("x-refresh-token") || bodyToken;
  if (!expectedToken || provided !== expectedToken) {
    return error("未授权：x-refresh-token 缺失或不匹配（请在「设置 → B 端运营」配置 b2b_daily_refresh_token）", 401);
  }

  // 幂等：同一自然日只执行一次（手动触发可用 ?force=1 跳过）
  const force = new URL(request.url).searchParams.get("force") === "1";
  const sb = getSupabase();
  if (!force) {
    const { data } = await sb
      .from("ai_config")
      .select("value")
      .eq("key", "b2b_daily_refresh_last_run")
      .maybeSingle();
    if ((data as { value?: string } | null)?.value === today()) {
      return success({ idempotent: true, date: today(), message: "今日任务已执行，跳过重复触发（可加 ?force=1 强制）" });
    }
  }

  // 1) 三平台真实趋势抓取 + 落库（含缓存清理语义）
  const platformResults: Record<string, { degraded: boolean; count: number; warning?: string }> = {};
  for (const platform of PLATFORMS) {
    try {
      const r = await b2b.fetchKeywordTrends({ platform, refresh: true });
      platformResults[platform] = {
        degraded: r.degraded,
        count: r.keywords.length,
        warning: r.warning,
      };
    } catch (err) {
      platformResults[platform] = {
        degraded: true,
        count: 0,
        warning: err instanceof Error ? err.message : "抓取失败",
      };
    }
  }

  // 2) 摘要 + 推送（按设置开关走 b2b_daily_digest → b2b_push_feishu/wecom）
  let digest: unknown = null;
  let digestError: string | undefined;
  try {
    digest = await b2b.runDailyDigest({
      pushFeishu: settings.b2bPushFeishuEnabled === "true",
      pushWecom: settings.b2bPushWecomEnabled === "true",
    });
  } catch (err) {
    digestError = err instanceof Error ? err.message : "每日摘要编排失败";
  }

  // 3) 记录执行日期（幂等标记）
  await sb.from("ai_config").upsert(
    { key: "b2b_daily_refresh_last_run", value: today(), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );

  return success({
    date: today(),
    platforms: platformResults,
    digest,
    digestError,
  });
});

export { methodNotAllowed as GET };
export { methodNotAllowed as PUT };
export { methodNotAllowed as DELETE };
