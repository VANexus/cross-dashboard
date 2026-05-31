import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, notFound, methodNotAllowed } from "@/lib/api-response";
import { parseBody, updateRiskEventSchema } from "@/lib/api-validation";
import { RiskService } from "@/lib/services";

const service = new RiskService();

export const PATCH = withDb(async (request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const parsed = parseBody(updateRiskEventSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const event = service.resolveEvent(id, parsed.data.resolvedAt);
  if (!event) return notFound("Risk event");
  return success(event);
});

export { methodNotAllowed as GET };
export { methodNotAllowed as POST };
export { methodNotAllowed as DELETE };