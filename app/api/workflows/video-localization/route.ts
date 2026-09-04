import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, methodNotAllowed } from "@/lib/server/api-response";
import { LocalizeService } from "@/lib/server/services";

const service = new LocalizeService();

export const GET = withDb(async (_: NextRequest) => {
  const tasks = await service.getTasks();
  return success(tasks);
});

export { methodNotAllowed as POST };