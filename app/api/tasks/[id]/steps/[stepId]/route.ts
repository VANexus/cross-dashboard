import { NextRequest } from "next/server";
import { success, notFound, badRequest, methodNotAllowed } from "@/lib/api-response";
import { updateStepSchema } from "@/lib/api-validation";
import { updateTaskStep } from "@/lib/mock-data-store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const { id, stepId } = await params;
  const body = await request.json();
  const parsed = updateStepSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid step data", parsed.error.flatten());
  const step = updateTaskStep(id, stepId, parsed.data);
  if (!step) return notFound("Task step");
  return success(step);
}

export async function GET() {
  return methodNotAllowed();
}
