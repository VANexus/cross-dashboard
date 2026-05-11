import { NextRequest } from "next/server";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { updateIsolationSchema } from "@/lib/api-validation";
import { getIsolationItems, updateIsolationItem } from "@/lib/mock-data-store";

export async function GET() {
  const items = getIsolationItems();
  return success({ items });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const parsed = updateIsolationSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid isolation data", parsed.error.flatten());
  const items = updateIsolationItem(parsed.data.index, parsed.data.checked);
  return success({ items });
}

export async function POST() {
  return methodNotAllowed();
}
