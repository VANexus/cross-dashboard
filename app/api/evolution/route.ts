import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody, createEvolutionSchema, paginationSchema } from "@/lib/api-validation";
import { EvolutionService } from "@/lib/services";

const service = new EvolutionService();

export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const pagination = paginationSchema.safeParse({ page: searchParams.get("page"), pageSize: searchParams.get("pageSize") });
  if (!pagination.success) return badRequest("Invalid pagination parameters");
  const result = service.list({
    stage: searchParams.get("stage") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    ...pagination.data,
  });
  return success(result.items, result.pagination);
});

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(createEvolutionSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const record = service.create(parsed.data);
  return success(record);
});