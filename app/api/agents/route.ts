import { NextRequest } from "next/server";
import { success, methodNotAllowed } from "@/lib/api-response";
import { getAgents } from "@/lib/mock-data-store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const type = searchParams.get("type") || undefined;
  const data = getAgents({ status, type });
  return success(data);
}

export async function POST() {
  return methodNotAllowed();
}
