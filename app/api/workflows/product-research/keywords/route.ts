import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, methodNotAllowed } from "@/lib/server/api-response";
import { WorkflowService } from "@/lib/server/services";

const service = new WorkflowService();

export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const marketplace = searchParams.get("marketplace") ?? undefined;
  const data = await service.getProductKeywords(marketplace);
  return success(data);
});

export { methodNotAllowed as POST };