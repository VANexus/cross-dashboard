import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, methodNotAllowed } from "@/lib/server/api-response";
import { WorkflowService } from "@/lib/server/services";

const service = new WorkflowService();

export const POST = withDb(async (_: NextRequest) => {
  const data = await service.exportAdData();
  return success(data);
});

export { methodNotAllowed as GET };