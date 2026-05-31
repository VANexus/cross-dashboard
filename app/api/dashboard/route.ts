import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed } from "@/lib/api-response";
import { DashboardService } from "@/lib/services";

const service = new DashboardService();

export const GET = withDb(async (_request: NextRequest) => {
  const data = service.getDashboardData();
  return success(data);
});

export { methodNotAllowed as POST };