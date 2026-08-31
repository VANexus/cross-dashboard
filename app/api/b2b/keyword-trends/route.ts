import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody, b2bKeywordTrendSchema } from "@/lib/api-validation";
import { B2BService, ContentMCPError } from "@/lib/services";
import type { TrendPlatform } from "@/lib/types";

const service = new B2BService();

export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const platform = (searchParams.get("platform") ?? "tiktok") as TrendPlatform;
  const refresh = searchParams.get("refresh") === "1";
  const keyword = searchParams.get("keyword")?.trim() || undefined;
  try {
    const result = await service.fetchKeywordTrends({ platform, keyword, refresh });
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