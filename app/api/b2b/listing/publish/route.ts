import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody, b2bListingPublishSchema } from "@/lib/api-validation";
import { B2BService, ContentMCPError } from "@/lib/services";

const service = new B2BService();

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(b2bListingPublishSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const result = await service.publishListing({ listingId: parsed.data.listingId });
    return success(result);
  } catch (err) {
    if (err instanceof ContentMCPError) return error(err.message, err.category === "skill" ? 422 : 503);
    return error(err instanceof Error ? err.message : "上传发布失败", 500);
  }
});

export { methodNotAllowed as GET };