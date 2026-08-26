import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody, contentImageSchema } from "@/lib/api-validation";
import { ContentService, ContentMCPError } from "@/lib/services";

const service = new ContentService();

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(contentImageSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const result = await service.generateImages(parsed.data);
    return success(result);
  } catch (err) {
    if (err instanceof ContentMCPError) {
      return error(err.message, err.category === "skill" ? 422 : 503);
    }
    return error(err instanceof Error ? err.message : "配图生成失败", 500);
  }
});

export { methodNotAllowed as GET };
export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
