import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed } from "@/lib/api-response";
import { WorkflowService } from "@/lib/services";

const service = new WorkflowService();

export const GET = withDb(async (_: NextRequest) => {
  const data = service.getInfringementWords();
  return success(data);
});

export { methodNotAllowed as POST };