import { NextRequest } from "next/server";
import { success, notFound, badRequest, methodNotAllowed } from "@/lib/api-response";
import { updateMemorySchema } from "@/lib/api-validation";
import { getMemoryById, updateMemory, deleteMemory } from "@/lib/mock-data-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entry = getMemoryById(id);
  if (!entry) return notFound("Memory entry");
  return success(entry);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateMemorySchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid update data", parsed.error.flatten());
  const entry = updateMemory(id, parsed.data);
  if (!entry) return notFound("Memory entry");
  return success(entry);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = deleteMemory(id);
  if (!ok) return notFound("Memory entry");
  return success({ id });
}

export async function POST() {
  return methodNotAllowed();
}
