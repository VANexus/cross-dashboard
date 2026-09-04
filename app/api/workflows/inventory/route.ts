import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { paginationSchema } from "@/lib/server/api-validation";
import { WorkflowService } from "@/lib/server/services";

const service = new WorkflowService();

export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const pagination = paginationSchema.safeParse({ page: searchParams.get("page"), pageSize: searchParams.get("pageSize") });
  if (!pagination.success) return badRequest("Invalid pagination parameters");
  const result = await service.getInventoryItems({
    status: searchParams.get("status") ?? undefined,
    ...pagination.data,
  });
  return success(result.items, result.pagination);
});

export { methodNotAllowed as POST };