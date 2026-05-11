import { NextRequest } from "next/server";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { generateImageSchema } from "@/lib/api-validation";
import { createTask } from "@/lib/mock-data-store";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = generateImageSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid image params", parsed.error.flatten());
  const task = createTask({
    title: `AI 作图 — ${parsed.data.type}`,
    description: `Prompt: ${parsed.data.prompt}, Model: ${parsed.data.model}`,
    priority: "medium",
    assignedAgents: ["marketing-001"],
  });
  return success(task);
}

export async function GET() {
  return methodNotAllowed();
}
