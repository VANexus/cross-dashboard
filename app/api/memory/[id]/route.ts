import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, notFound, methodNotAllowed } from "@/lib/api-response";
import { parseBody, updateMemorySchema } from "@/lib/api-validation";
import { MemoryService } from "@/lib/services";

const service = new MemoryService();

export const GET = withDb(async (_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const entry = await service.getById(id);
  if (!entry) return notFound("Memory entry");
  return success(entry);
});

export const PATCH = withDb(async (request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const parsed = parseBody(updateMemorySchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const entry = await service.update(id, parsed.data);
  if (!entry) return notFound("Memory entry");
  return success(entry);
});

export const DELETE = withDb(async (_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ok = await service.delete(id);
  if (!ok) return notFound("Memory entry");
  return success({ deleted: true });
});

export { methodNotAllowed as POST };