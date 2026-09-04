import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, notFound, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, updateStepSchema } from "@/lib/server/api-validation";
import { TaskService } from "@/lib/server/services";

const service = new TaskService();

export const PATCH = withDb(async (request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }) => {
  const { id, stepId } = await params;
  const parsed = parseBody(updateStepSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const step = service.updateStep(id, stepId, parsed.data);
  if (!step) return notFound("Task step");
  return success(step);
});

export { methodNotAllowed as GET };
export { methodNotAllowed as POST };
export { methodNotAllowed as DELETE };