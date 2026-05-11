import { NextRequest } from "next/server";
import { success, methodNotAllowed } from "@/lib/api-response";
import { getEvolutionTrend } from "@/lib/mock-data-store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const months = searchParams.get("months") ? Number(searchParams.get("months")) : 6;
  const data = getEvolutionTrend(months);
  return success(data);
}

export async function POST() {
  return methodNotAllowed();
}
