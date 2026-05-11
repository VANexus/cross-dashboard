import { NextRequest } from "next/server";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { createRiskEventSchema, paginationSchema } from "@/lib/api-validation";
import { getRiskEvents, createRiskEvent } from "@/lib/mock-data-store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
  });
  if (!parsed.success) return badRequest("Invalid pagination", parsed.error.flatten());
  const { page, pageSize } = parsed.data;
  const level = searchParams.get("level") || undefined;
  const resolved = searchParams.get("resolved") || undefined;
  const data = getRiskEvents({ level, resolved, page, pageSize });
  return success(data.items, data.pagination);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createRiskEventSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid risk event data", parsed.error.flatten());
  const event = createRiskEvent(parsed.data);
  return success(event);
}
