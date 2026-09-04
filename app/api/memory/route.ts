import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest } from "@/lib/server/api-response";
import { parseBody, createMemorySchema, paginationSchema } from "@/lib/server/api-validation";
import { MemoryService } from "@/lib/server/services";

const service = new MemoryService();

export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const pagination = paginationSchema.safeParse({ page: searchParams.get("page"), pageSize: searchParams.get("pageSize") });
  if (!pagination.success) return badRequest("Invalid pagination parameters");
  const result = await service.list({
    zone: searchParams.get("zone") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    agentId: searchParams.get("agentId") ?? undefined,
    ...pagination.data,
  });
  return success(result.items, result.pagination);
});

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(createMemorySchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const entry = await service.create(parsed.data);
  return success(entry);
});