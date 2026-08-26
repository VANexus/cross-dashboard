import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed } from "@/lib/api-response";
import { LocalizeService } from "@/lib/services";

const service = new LocalizeService();

export const POST = withDb(async (_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const result = await service.retryTask(id);
  return success(result);
});

export { methodNotAllowed as GET };