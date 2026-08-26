import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed } from "@/lib/api-response";
import { LocalizeService } from "@/lib/services";

const service = new LocalizeService();

export const GET = withDb(async (_request: NextRequest) => {
  const health = await service.getHealth();
  return success(health);
});

export { methodNotAllowed as POST };