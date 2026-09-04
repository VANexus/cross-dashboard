import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, methodNotAllowed } from "@/lib/server/api-response";
import { LocalizeService } from "@/lib/server/services";

const service = new LocalizeService();

export const GET = withDb(async (_: NextRequest) => {
  const health = await service.getHealth();
  return success(health);
});

export { methodNotAllowed as POST };