import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, notFound, methodNotAllowed } from "@/lib/api-response";
import { LocalizeService } from "@/lib/services";

const service = new LocalizeService();

export const GET = withDb(async (_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const task = await service.getTask(id);
  if (!task) return notFound("LocalizeTask");
  return success(task);
});

export const DELETE = withDb(async (_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const result = await service.cancelTask(id);
  return success(result);
});

export { methodNotAllowed as POST };