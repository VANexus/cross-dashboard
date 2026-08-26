import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed } from "@/lib/api-response";
import { LocalizeService } from "@/lib/services";

const service = new LocalizeService();

export const GET = withDb(async (_request: NextRequest) => {
  const tasks = await service.getTasks();
  return success(tasks);
});

export { methodNotAllowed as POST };