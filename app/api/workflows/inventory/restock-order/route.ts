import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody, createRestockOrderSchema } from "@/lib/api-validation";
import { WorkflowService } from "@/lib/services";

const service = new WorkflowService();

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(createRestockOrderSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const result = await service.createRestockOrder(parsed.data.items);
  return success(result);
});

export { methodNotAllowed as GET };