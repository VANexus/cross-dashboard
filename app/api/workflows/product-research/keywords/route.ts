import { NextRequest } from "next/server";
import { success, methodNotAllowed } from "@/lib/api-response";
import { getProductKeywords } from "@/lib/workflow-data-store";

export async function GET(request: NextRequest) {
  const marketplace = new URL(request.url).searchParams.get("marketplace") || undefined;
  return success(getProductKeywords(marketplace));
}

export async function POST() {
  return methodNotAllowed();
}
