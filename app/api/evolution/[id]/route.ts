import { NextRequest } from "next/server";
import { success, notFound, badRequest, methodNotAllowed } from "@/lib/api-response";
import { updateEvolutionSchema } from "@/lib/api-validation";
import { getEvolutionById, updateEvolution } from "@/lib/mock-data-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = getEvolutionById(id);
  if (!record) return notFound("Evolution record");
  return success(record);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateEvolutionSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid update data", parsed.error.flatten());
  const record = updateEvolution(id, parsed.data);
  if (!record) return notFound("Evolution record");
  return success(record);
}

export async function POST() {
  return methodNotAllowed();
}
