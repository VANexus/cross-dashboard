import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, wechatTypesetSchema } from "@/lib/server/api-validation";
import { WechatService, WechatMCPError } from "@/lib/server/services";

const service = new WechatService();

/** GET /api/wechat/typeset/themes — 内置排版主题 */
export const GET = withDb(async () => success(service.getThemes()));

/** POST /api/wechat/typeset — Markdown → 内联样式 HTML（flowmind content_typeset） */
export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(wechatTypesetSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    return success(await service.typeset(parsed.data));
  } catch (err) {
    if (err instanceof WechatMCPError) {
      return error(err.message, err.category === "skill" ? 422 : 503);
    }
    return error(err instanceof Error ? err.message : "排版失败", 500);
  }
});

export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
