import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody, b2bImageGenSchema } from "@/lib/api-validation";
import { B2BService, ContentMCPError } from "@/lib/services";

const service = new B2BService();

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(b2bImageGenSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const result = await service.generateWithSkill({ skillId: parsed.data.skillId, prompt: parsed.data.prompt });
    return success(result);
  } catch (err) {
    if (err instanceof ContentMCPError) return error(err.message, err.category === "skill" ? 422 : 503);
    return error(err instanceof Error ? err.message : "生图失败", 500);
  }
});

export { methodNotAllowed as GET };