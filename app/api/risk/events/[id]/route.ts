import { NextRequest } from "next/server";
import { success, notFound, badRequest, methodNotAllowed } from "@/lib/api-response";
import { updateRiskEventSchema } from "@/lib/api-validation";
import { updateRiskEvent } from "@/lib/mock-data-store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateRiskEventSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid update data", parsed.error.flatten());
  const event = updateRiskEvent(id, parsed.data);
  if (!event) return notFound("Risk event");
  return success(event);
}

export async function GET() {
  return methodNotAllowed();
}
