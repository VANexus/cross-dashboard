import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, methodNotAllowed } from "@/lib/server/api-response";
import { LocalizeService } from "@/lib/server/services";

const service = new LocalizeService();

export const POST = withDb(async (_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const result = await service.retryTask(id);
  return success(result);
});

export { methodNotAllowed as GET };