import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed, error } from "@/lib/api-response";
import { WorkflowService } from "@/lib/services";

const service = new WorkflowService();

export const POST = withDb(async (_: NextRequest) => {
  try {
    const result = await service.generateRestockSuggestions();
    return success(result);
  } catch (err) {
    return error(err instanceof Error ? err.message : "操作失败", 500);
  }
});

export { methodNotAllowed as GET };
