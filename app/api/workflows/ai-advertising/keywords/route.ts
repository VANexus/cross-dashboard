import { NextRequest } from "next/server";
import { success, methodNotAllowed } from "@/lib/api-response";
import { getAdKeywords } from "@/lib/workflow-data-store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || undefined;
  const tag = searchParams.get("tag") || undefined;
  return success(getAdKeywords({ type, tag }));
}

export async function POST() {
  return methodNotAllowed();
}
