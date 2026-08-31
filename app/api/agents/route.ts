import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed } from "@/lib/api-response";
import { AgentService } from "@/lib/services";

const service = new AgentService();

export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const data = await service.list({
    status: searchParams.get("status") ?? undefined,
    type: searchParams.get("type") ?? undefined,
  });
  return success(data, { page: 1, pageSize: 50, total: data.length, totalPages: 1 });
});

export { methodNotAllowed as POST };