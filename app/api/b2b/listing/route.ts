import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, b2bListingGenerateSchema } from "@/lib/server/api-validation";
import { B2BService, ContentMCPError } from "@/lib/server/services";

const service = new B2BService();

export const GET = withDb(async () => {
  return success(await service.getListings());
});

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(b2bListingGenerateSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const result = await service.generateListing({
      productId: parsed.data.productId,
      subject: parsed.data.subject,
      keyword: parsed.data.keyword,
      preference: parsed.data.preference,
    });
    return success(result);
  } catch (err) {
    if (err instanceof ContentMCPError) return error(err.message, err.category === "skill" ? 422 : 503);
    return error(err instanceof Error ? err.message : "Listing 生成失败", 500);
  }
});

export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };