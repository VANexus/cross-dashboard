import { NextRequest } from "next/server";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { executeResearchSchema } from "@/lib/api-validation";
import { createTask } from "@/lib/mock-data-store";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = executeResearchSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid research params", parsed.error.flatten());
  const task = createTask({
    title: `选品采集 — ${parsed.data.marketplace}`,
    description: `数据源: ${parsed.data.sources.join(", ")}`,
    priority: "high",
    assignedAgents: ["ops-001"],
  });
  return success(task);
}

export async function GET() {
  return methodNotAllowed();
}
