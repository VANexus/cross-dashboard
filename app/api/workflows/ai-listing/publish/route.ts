import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, publishListingSchema } from "@/lib/server/api-validation";
import { WorkflowService } from "@/lib/server/services";

const service = new WorkflowService();

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(publishListingSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const result = await service.publishListing(parsed.data);
  return success(result);
});

export { methodNotAllowed as GET };