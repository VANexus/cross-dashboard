import { NextRequest } from "next/server";
import { success, methodNotAllowed } from "@/lib/api-response";
import { getCompetitorKeywords } from "@/lib/workflow-data-store";

export async function GET(request: NextRequest) {
  const type = new URL(request.url).searchParams.get("type") || undefined;
  return success(getCompetitorKeywords(type));
}

export async function POST() {
  return methodNotAllowed();
}
