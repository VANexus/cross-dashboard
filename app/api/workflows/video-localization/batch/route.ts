import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody, submitLocalizeBatchSchema } from "@/lib/api-validation";
import { LocalizeService } from "@/lib/services";

const service = new LocalizeService();

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(submitLocalizeBatchSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const report = await service.submitBatch(parsed.data);
  return success(report);
});

export { methodNotAllowed as GET };