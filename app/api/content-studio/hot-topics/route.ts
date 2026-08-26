import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody, contentHotSchema } from "@/lib/api-validation";
import { ContentService, ContentMCPError } from "@/lib/services";

const service = new ContentService();

/** GET /api/content-studio/hot-topics?platform=xhs&refresh=1 */
export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const platform = (searchParams.get("platform") ?? "xhs") as "xhs" | "wechat" | "douyin";
  const refresh = searchParams.get("refresh") === "1";
  try {
    const result = await service.fetchHotTopics({ platform, refresh });
    return success(result);
  } catch (err) {
    if (err instanceof ContentMCPError) {
      return error(err.message, err.category === "skill" ? 422 : 503);
    }
    return error(err instanceof Error ? err.message : "热点抓取失败", 500);
  }
});

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(contentHotSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const result = await service.fetchHotTopics({ platform: parsed.data.platform, refresh: true });
    return success(result);
  } catch (err) {
    if (err instanceof ContentMCPError) {
      return error(err.message, err.category === "skill" ? 422 : 503);
    }
    return error(err instanceof Error ? err.message : "热点刷新失败", 500);
  }
});

export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
