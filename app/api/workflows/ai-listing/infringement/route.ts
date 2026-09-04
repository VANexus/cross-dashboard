import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, methodNotAllowed } from "@/lib/server/api-response";
import { WorkflowService } from "@/lib/server/services";

const service = new WorkflowService();

export const GET = withDb(async (_: NextRequest) => {
  const data = await service.getInfringementWords();
  return success(data);
});

export { methodNotAllowed as POST };