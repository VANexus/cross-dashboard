import type { NextRequest } from "next/server";
import { success, error, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, adIntelSchema } from "@/lib/server/api-validation";
import { IntelService } from "@/lib/server/services";
import { ContentMCPError } from "@/lib/mcp/client";

const service = new IntelService();

export const POST = async (request: NextRequest) => {
  const parsed = parseBody(adIntelSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const q = parsed.data;
  try {
    let result: Awaited<ReturnType<IntelService["searchAds"]>>;
    switch (q.action) {
      case "search_ads":
        if (!q.keyword?.trim()) return badRequest("search_ads 需要关键词 keyword");
        result = await service.searchAds({
          keyword: q.keyword, period: q.period, objective: q.objective, industry: q.industry,
          countryCode: q.countryCode, page: q.page, limit: q.limit, orderBy: q.orderBy,
        });
        break;
      case "filters":
        result = await service.adFilters();
        break;
      case "locations":
        result = await service.adLocations();
        break;
      case "hashtag_detail":
        if (!q.hashtagId?.trim()) return badRequest("hashtag_detail 需要 hashtagId");
        result = await service.hashtagDetail({ hashtagId: q.hashtagId, timeRange: q.timeRange, countryCode: q.countryCode });
        break;
      default:
        return badRequest("不支持的 action");
    }
    return success(result);
  } catch (err) {
    if (err instanceof ContentMCPError) return error(err.message, err.category === "skill" ? 422 : 503);
    return error(err instanceof Error ? err.message : "广告情报查询失败", 500);
  }
};

export { methodNotAllowed as GET };
export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
