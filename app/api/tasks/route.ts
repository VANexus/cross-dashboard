import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest } from "@/lib/api-response";
import { parseBody, createTaskSchema, paginationSchema } from "@/lib/api-validation";
import { TaskService } from "@/lib/services";

const service = new TaskService();

export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const pagination = paginationSchema.safeParse({ page: searchParams.get("page"), pageSize: searchParams.get("pageSize") });
  if (!pagination.success) return badRequest("Invalid pagination parameters");
  const result = await service.list({
    status: searchParams.get("status") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
    ...pagination.data,
  });
  return success(result.items, result.pagination);
});

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(createTaskSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const task = service.create(parsed.data);
  return success(task);
});