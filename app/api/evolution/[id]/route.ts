import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, notFound, methodNotAllowed } from "@/lib/api-response";
import { parseBody, updateEvolutionSchema } from "@/lib/api-validation";
import { EvolutionService } from "@/lib/services";

const service = new EvolutionService();

export const GET = withDb(async (_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const record = await service.getById(id);
  if (!record) return notFound("Evolution record");
  return success(record);
});

export const PATCH = withDb(async (request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const parsed = parseBody(updateEvolutionSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const record = await service.update(id, parsed.data);
  if (!record) return notFound("Evolution record");
  return success(record);
});

export { methodNotAllowed as POST };