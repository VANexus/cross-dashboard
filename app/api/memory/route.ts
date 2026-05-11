import { NextRequest } from "next/server";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { createMemorySchema, paginationSchema } from "@/lib/api-validation";
import { getMemoryEntries, createMemory } from "@/lib/mock-data-store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
  });
  if (!parsed.success) return badRequest("Invalid pagination", parsed.error.flatten());
  const { page, pageSize } = parsed.data;
  const zone = searchParams.get("zone") || undefined;
  const type = searchParams.get("type") || undefined;
  const search = searchParams.get("search") || undefined;
  const data = getMemoryEntries({ zone, type, search, page, pageSize });
  return success(data.items, data.pagination);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createMemorySchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid memory data", parsed.error.flatten());
  const entry = createMemory(parsed.data);
  return success(entry);
}
