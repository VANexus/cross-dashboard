import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, b2bLongtailSchema } from "@/lib/server/api-validation";
import { B2BService, ContentMCPError } from "@/lib/server/services";

const service = new B2BService();

export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const industry = searchParams.get("industry") ?? "";
  return success(industry ? await service.getLongtail(industry) : []);
});

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(b2bLongtailSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const result = await service.generateLongtail({
      industry: parsed.data.industry,
      seedKeywords: parsed.data.seedKeywords ?? [],
      limit: parsed.data.limit,
    });
    return success(result);
  } catch (err) {
    if (err instanceof ContentMCPError) return error(err.message, err.category === "skill" ? 422 : 503);
    return error(err instanceof Error ? err.message : "长尾词生成失败", 500);
  }
});

export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };