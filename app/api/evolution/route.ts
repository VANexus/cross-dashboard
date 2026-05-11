import { NextRequest } from "next/server";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { createEvolutionSchema, paginationSchema } from "@/lib/api-validation";
import { getEvolutionRecords, createEvolution } from "@/lib/mock-data-store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
  });
  if (!parsed.success) return badRequest("Invalid pagination", parsed.error.flatten());
  const { page, pageSize } = parsed.data;
  const stage = searchParams.get("stage") || undefined;
  const status = searchParams.get("status") || undefined;
  const data = getEvolutionRecords({ stage, status, page, pageSize });
  return success(data.items, data.pagination);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createEvolutionSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid evolution data", parsed.error.flatten());
  const record = createEvolution(parsed.data);
  return success(record);
}
