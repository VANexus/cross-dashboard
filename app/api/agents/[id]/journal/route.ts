import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, notFound, methodNotAllowed } from "@/lib/server/api-response";
import * as journalRepo from "@/lib/server/repositories/journal.repository";
import * as agentRepo from "@/lib/server/repositories/agent.repository";

export const GET = withDb(async (request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const agent = await agentRepo.getAgentById(id);
  if (!agent) return notFound("Agent");

  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const items = await journalRepo.getEntries(id, limit, offset);
  const total = await journalRepo.getEntryCount(id);

  return success(items, { page: Math.floor(offset / limit) + 1, pageSize: limit, total, totalPages: Math.ceil(total / limit) });
});

export { methodNotAllowed as POST };
