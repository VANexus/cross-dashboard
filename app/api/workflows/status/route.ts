import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed, CONFIG_CACHE_HEADERS } from "@/lib/api-response";
import { WorkflowService } from "@/lib/services";

const service = new WorkflowService();

export const GET = withDb(async (_: NextRequest) => {
  const data = await service.getWorkflowStatuses();
  return success(data, undefined, 200, CONFIG_CACHE_HEADERS);
});

export { methodNotAllowed as POST };