import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, updateIsolationSchema } from "@/lib/server/api-validation";
import { RiskService } from "@/lib/server/services";

const service = new RiskService();

export const GET = withDb(async (_: NextRequest) => {
  const items = await service.getIsolationItems();
  return success(items);
});

export const PATCH = withDb(async (request: NextRequest) => {
  const parsed = parseBody(updateIsolationSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const ok = await service.updateIsolation(parsed.data.index, parsed.data.checked);
  if (!ok) return badRequest("Isolation item not found");
  return success({ updated: true });
});

export { methodNotAllowed as POST };