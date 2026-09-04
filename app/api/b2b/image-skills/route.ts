import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, b2bImageSkillCreateSchema } from "@/lib/server/api-validation";
import { B2BService } from "@/lib/server/services";

const service = new B2BService();

export const GET = withDb(async () => {
  return success(await service.getImageSkills());
});

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(b2bImageSkillCreateSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const skill = await service.createImageSkill({
      name: parsed.data.name,
      coverUrl: parsed.data.coverUrl,
      reversedPrompt: parsed.data.reversedPrompt,
      styleTags: parsed.data.styleTags,
      aspectRatio: parsed.data.aspectRatio,
      platform: parsed.data.platform,
    });
    return success(skill);
  } catch (err) {
    return error(err instanceof Error ? err.message : "生图 skill 创建失败", 500);
  }
});

export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };