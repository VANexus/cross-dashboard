import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, notFound, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, updateTaskSchema } from "@/lib/server/api-validation";
import { TaskService } from "@/lib/server/services";

const service = new TaskService();

export const GET = withDb(async (_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const task = service.getById(id);
  if (!task) return notFound("Task");
  return success(task);
});

export const PATCH = withDb(async (request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const parsed = parseBody(updateTaskSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const task = service.update(id, parsed.data);
  if (!task) return notFound("Task");
  return success(task);
});

export const DELETE = withDb(async (_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ok = service.delete(id);
  if (!ok) return notFound("Task");
  return success({ deleted: true });
});

export { methodNotAllowed as POST };