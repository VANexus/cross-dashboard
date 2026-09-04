import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, methodNotAllowed } from "@/lib/server/api-response";
import { RiskService } from "@/lib/server/services";

const service = new RiskService();

export const GET = withDb(async (_: NextRequest) => {
  const data = await service.getHealth();
  return success(data);
});

export { methodNotAllowed as POST };