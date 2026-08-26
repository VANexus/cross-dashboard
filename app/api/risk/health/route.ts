import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed } from "@/lib/api-response";
import { RiskService } from "@/lib/services";

const service = new RiskService();

export const GET = withDb(async (_: NextRequest) => {
  const data = service.getHealth();
  return success(data);
});

export { methodNotAllowed as POST };