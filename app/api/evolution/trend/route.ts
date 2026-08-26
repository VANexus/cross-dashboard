import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed } from "@/lib/api-response";
import { EvolutionService } from "@/lib/services";

const service = new EvolutionService();

export const GET = withDb(async (_: NextRequest) => {
  const data = service.getTrend();
  return success(data);
});

export { methodNotAllowed as POST };