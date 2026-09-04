import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, b2bKeywordTrendSchema } from "@/lib/server/api-validation";
import { B2BService, ContentMCPError } from "@/lib/server/services";
import { getKeywordTrends, getKeywordTrendsFetchedAt } from "@/lib/server/repositories/b2b.repository";
import { shouldBackgroundRefresh } from "@/lib/utils/refresh-gate";
import type { TrendPlatform } from "@/lib/shared/types";

const service = new B2BService();

/** DB 数据视为新鲜的时间窗（与 flowmind _tikhub_cache 默认 soft TTL 一致） */
const FRESH_MS = 30 * 60_000;

export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const platform = (searchParams.get("platform") ?? "tiktok") as TrendPlatform;
  const refresh = searchParams.get("refresh") === "1";
  const keyword = searchParams.get("keyword")?.trim() || undefined;

  // 强制刷新或带关键词搜索：同步走真实抓取（用户明确要新数据）
  if (refresh || keyword) {
    try {
      const result = await service.fetchKeywordTrends({ platform, keyword, refresh });
      return success(result);
    } catch (err) {
      if (err instanceof ContentMCPError) return error(err.message, err.category === "skill" ? 422 : 503);
      return error(err instanceof Error ? err.message : "关键词趋势抓取失败", 500);
    }
  }

  // DB 秒回：有缓存直接返回（跨页面切换不再等几秒），过期则后台保鲜
  const [cached, fetchedAt] = await Promise.all([
    getKeywordTrends(platform),
    getKeywordTrendsFetchedAt(platform).catch(() => null),
  ]);

  if (cached.length > 0) {
    const ageMs = fetchedAt ? Date.now() - new Date(fetchedAt).getTime() : Number.POSITIVE_INFINITY;
    // 防抖门：同一平台 10 分钟内只放行一次后台付费刷新
    const refreshing = ageMs >= FRESH_MS && shouldBackgroundRefresh(`kw-trends:${platform}`);
    if (refreshing) {
      service.fetchKeywordTrends({ platform, refresh: true }).catch(
        (e) => console.error("[kw-trends 后台保鲜]", e instanceof Error ? e.message : e),
      );
    }
    return success({
      platform,
      source: "cache",
      degraded: false,
      keywords: cached,
      fetchedAt: fetchedAt ?? undefined,
      refreshing,
    });
  }

  // 冷启动：无任何 DB 数据，同步抓取
  try {
    const result = await service.fetchKeywordTrends({ platform, refresh: true });
    return success(result);
  } catch (err) {
    if (err instanceof ContentMCPError) return error(err.message, err.category === "skill" ? 422 : 503);
    return error(err instanceof Error ? err.message : "关键词趋势抓取失败", 500);
  }
});

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(b2bKeywordTrendSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const result = await service.fetchKeywordTrends({
      platform: parsed.data.platform,
      industryId: parsed.data.industryId,
      keyword: parsed.data.keyword,
      refresh: true,
    });
    return success(result);
  } catch (err) {
    if (err instanceof ContentMCPError) return error(err.message, err.category === "skill" ? 422 : 503);
    return error(err instanceof Error ? err.message : "关键词趋势刷新失败", 500);
  }
});

export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };