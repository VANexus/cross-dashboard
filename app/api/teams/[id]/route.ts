import { NextRequest } from "next/server";
import { z } from "zod";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, notFound } from "@/lib/server/api-response";
import { parseBody } from "@/lib/server/api-validation";
import * as teamRepo from "@/lib/server/repositories/team.repository";

/** PATCH：增删团队成员 / 换 leader。 DELETE：解散团队。 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const schema = z.object({
    addMembers: z.array(z.string()).optional(),
    removeMembers: z.array(z.string()).optional(),
    leaderAgentId: z.string().nullable().optional(),
  });
  const parsed = parseBody(schema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  if (parsed.data.addMembers?.length) {
    const t = await teamRepo.addTeamMembers(id, parsed.data.addMembers);
    if (!t) return notFound();
  }
  if (parsed.data.removeMembers?.length) {
    const t = await teamRepo.removeTeamMembers(id, parsed.data.removeMembers);
    if (!t) return notFound();
  }
  if (parsed.data.leaderAgentId !== undefined) {
    const t = await teamRepo.updateTeamLeader(id, parsed.data.leaderAgentId);
    if (!t) return notFound();
  }
  const team = await teamRepo.getTeamById(id);
  return team ? success(team) : notFound();
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = await teamRepo.deleteTeam(id);
  return success({ ok });
}
