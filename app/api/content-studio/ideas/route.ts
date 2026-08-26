import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody, contentIdeaSchema } from "@/lib/api-validation";
import { ContentService, ContentMCPError } from "@/lib/services";

const service = new ContentService();

export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") ?? undefined;
  return success(service.getIdeas(platform as never));
});

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(contentIdeaSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const ideas = await service.generateIdeas(parsed.data);
    return success(ideas);
  } catch (err) {
    if (err instanceof ContentMCPError) {
      return error(err.message, err.category === "skill" ? 422 : 503);
    }
    return error(err instanceof Error ? err.message : "思路生成失败", 500);
  }
});

export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
