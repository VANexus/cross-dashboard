import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, methodNotAllowed, error } from "@/lib/server/api-response";
import { parseBody, executeResearchSchema } from "@/lib/server/api-validation";
import { WorkflowService } from "@/lib/server/services";

const service = new WorkflowService();

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(executeResearchSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const result = await service.executeResearch(parsed.data);
    return success(result);
  } catch (err) {
    return error(err instanceof Error ? err.message : "操作失败", 500);
  }
});

export { methodNotAllowed as GET };