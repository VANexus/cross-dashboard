import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest } from "@/lib/api-response";
import { parseBody, createRiskEventSchema, paginationSchema } from "@/lib/api-validation";
import { RiskService } from "@/lib/services";

const service = new RiskService();

export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const pagination = paginationSchema.safeParse({ page: searchParams.get("page"), pageSize: searchParams.get("pageSize") });
  if (!pagination.success) return badRequest("Invalid pagination parameters");
  const result = await service.listEvents({
    level: searchParams.get("level") ?? undefined,
    resolved: searchParams.get("resolved") ? searchParams.get("resolved") === "true" : undefined,
    ...pagination.data,
  });
  return success(result.items, result.pagination);
});

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(createRiskEventSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const event = await service.createEvent(parsed.data);
  return success(event);
});