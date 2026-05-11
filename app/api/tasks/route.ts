import { NextRequest } from "next/server";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { createTaskSchema, paginationSchema } from "@/lib/api-validation";
import { getTasks, createTask } from "@/lib/mock-data-store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
  });
  if (!parsed.success) return badRequest("Invalid pagination", parsed.error.flatten());
  const { page, pageSize } = parsed.data;
  const status = searchParams.get("status") || undefined;
  const priority = searchParams.get("priority") || undefined;
  const data = getTasks({ status, priority, page, pageSize });
  return success(data.items, data.pagination);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid task data", parsed.error.flatten());
  const task = createTask(parsed.data);
  return success(task);
}
