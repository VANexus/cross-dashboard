import { NextRequest } from "next/server";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { paginationSchema } from "@/lib/api-validation";
import { getInventoryItems } from "@/lib/workflow-data-store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
  });
  if (!parsed.success) return badRequest("Invalid pagination", parsed.error.flatten());
  const status = searchParams.get("status") || undefined;
  const data = getInventoryItems({ status, ...parsed.data });
  return success(data.items, data.pagination);
}

export async function POST() {
  return methodNotAllowed();
}
