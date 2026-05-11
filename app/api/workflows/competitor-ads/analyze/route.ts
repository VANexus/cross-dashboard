import { NextRequest } from "next/server";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { analyzeCompetitorSchema } from "@/lib/api-validation";
import { createTask } from "@/lib/mock-data-store";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = analyzeCompetitorSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid analyze params", parsed.error.flatten());
  const task = createTask({
    title: `竞品广告分析 — ${parsed.data.asins.length} 个 ASIN`,
    description: `ASINs: ${parsed.data.asins.join(", ")}, 市场: ${parsed.data.marketplace}`,
    priority: "medium",
    assignedAgents: ["ops-001", "marketing-001"],
  });
  return success(task);
}

export async function GET() {
  return methodNotAllowed();
}
