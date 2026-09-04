import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, submitLocalizeBatchSchema } from "@/lib/server/api-validation";
import { LocalizeService } from "@/lib/server/services";

const service = new LocalizeService();

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(submitLocalizeBatchSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const report = await service.submitBatch(parsed.data);
  return success(report);
});

export { methodNotAllowed as GET };