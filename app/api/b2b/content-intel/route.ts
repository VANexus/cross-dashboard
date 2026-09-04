import type { NextRequest } from "next/server";
import { success, error, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, contentIntelSchema } from "@/lib/server/api-validation";
import { IntelService } from "@/lib/server/services";
import { ContentMCPError } from "@/lib/mcp/client";

const service = new IntelService();

export const POST = async (request: NextRequest) => {
  const parsed = parseBody(contentIntelSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const q = parsed.data;
  try {
    let result: Awaited<ReturnType<IntelService["videoSearch"]>>;
    switch (q.action) {
      case "trending_words":
        result = await service.trendingWords(q.limit ?? 30);
        break;
      case "video_search":
        if (!q.keyword?.trim()) return badRequest("video_search 需要关键词 keyword");
        result = await service.videoSearch({ keyword: q.keyword, limit: q.limit, region: q.region });
        break;
      case "music_chart":
        result = await service.musicChart(q.limit ?? 20);
        break;
      case "creator_insights":
        result = await service.creatorInsights(q.limit ?? 20);
        break;
      case "creator_profile":
        if (!q.uniqueId?.trim()) return badRequest("creator_profile 需要 uniqueId");
        result = await service.creatorProfile({ uniqueId: q.uniqueId, withCountry: q.withCountry });
        break;
      case "ig_hashtag_posts":
        if (!q.keyword?.trim()) return badRequest("ig_hashtag_posts 需要关键词 keyword");
        result = await service.igHashtagPosts({ keyword: q.keyword, feedType: q.feedType, limit: q.limit });
        break;
      default:
        return badRequest("不支持的 action");
    }
    return success(result);
  } catch (err) {
    if (err instanceof ContentMCPError) return error(err.message, err.category === "skill" ? 422 : 503);
    return error(err instanceof Error ? err.message : "内容情报查询失败", 500);
  }
};

export { methodNotAllowed as GET };
export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
