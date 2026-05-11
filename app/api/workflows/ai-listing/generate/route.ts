import { NextRequest } from "next/server";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { generateListingSchema } from "@/lib/api-validation";
import { createTask } from "@/lib/mock-data-store";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = generateListingSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid listing params", parsed.error.flatten());
  const task = createTask({
    title: `AI Listing 生成 — ${parsed.data.language}`,
    description: `关键词: ${parsed.data.keyword || "auto"}, 类目: ${parsed.data.category || "auto"}`,
    priority: "medium",
    assignedAgents: ["marketing-001", "ops-001"],
  });
  return success(task);
}

export async function GET() {
  return methodNotAllowed();
}
