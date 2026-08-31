import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed } from "@/lib/api-response";
import { DashboardService } from "@/lib/services";

const service = new DashboardService();

export const GET = withDb(async (_: NextRequest) => {
  const data = await service.getDashboardData();
  return success(data);
});

export { methodNotAllowed as POST };