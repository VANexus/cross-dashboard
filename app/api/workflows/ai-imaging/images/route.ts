import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed } from "@/lib/api-response";
import { WorkflowService } from "@/lib/services";

const service = new WorkflowService();

export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? undefined;
  const data = await service.getImages(type);
  return success(data);
});

export { methodNotAllowed as POST };