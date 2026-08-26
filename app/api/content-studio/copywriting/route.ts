import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody, contentCopySchema } from "@/lib/api-validation";
import { ContentService, ContentMCPError } from "@/lib/services";

const service = new ContentService();

/** GET /api/content-studio/copywriting?platform=xhs */
export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const drafts = service.getWorks().drafts;
  const platform = searchParams.get("platform");
  return success(platform ? drafts.filter((d) => d.platform === platform) : drafts);
});

/** POST 生成文案并落库为草稿 */
export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(contentCopySchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const draft = await service.generateCopy(parsed.data);
    return success(draft);
  } catch (err) {
    if (err instanceof ContentMCPError) {
      return error(err.message, err.category === "skill" ? 422 : 503);
    }
    return error(err instanceof Error ? err.message : "文案生成失败", 500);
  }
});

export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
