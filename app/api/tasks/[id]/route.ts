import { NextRequest } from "next/server";
import { success, notFound, badRequest, methodNotAllowed } from "@/lib/api-response";
import { updateTaskSchema } from "@/lib/api-validation";
import { getTaskById, updateTask, deleteTask } from "@/lib/mock-data-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const task = getTaskById(id);
  if (!task) return notFound("Task");
  return success(task);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid update data", parsed.error.flatten());
  const task = updateTask(id, parsed.data);
  if (!task) return notFound("Task");
  return success(task);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = deleteTask(id);
  if (!ok) return notFound("Task");
  return success({ id });
}

export async function POST() {
  return methodNotAllowed();
}
