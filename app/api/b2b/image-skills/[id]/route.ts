import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, methodNotAllowed, notFound } from "@/lib/api-response";
import { parseBody, b2bImageSkillUpdateSchema } from "@/lib/api-validation";
import { B2BService } from "@/lib/services";

const service = new B2BService();

export const GET = withDb(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const skill = (await service.getImageSkills()).find((s) => s.id === id);
  if (!skill) return notFound("生图 skill");
  return success(skill);
});

export const PATCH = withDb(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const parsed = parseBody(b2bImageSkillUpdateSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const skill = await service.updateImageSkill(id, parsed.data);
  if (!skill) return notFound("生图 skill");
  return success(skill);
});

export { methodNotAllowed as POST };
export { methodNotAllowed as DELETE };