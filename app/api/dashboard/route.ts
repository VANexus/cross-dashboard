import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, methodNotAllowed } from "@/lib/server/api-response";
import { DashboardService } from "@/lib/server/services";

const service = new DashboardService();

export const GET = withDb(async (_: NextRequest) => {
  const data = await service.getDashboardData();
  return success(data);
});

export { methodNotAllowed as POST };