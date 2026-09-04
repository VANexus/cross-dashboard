import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, notFound, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { agentRuntime } from "@/lib/server/agent-runtime/runtime";
import * as agentRepo from "@/lib/server/repositories/agent.repository";
import * as journalRepo from "@/lib/server/repositories/journal.repository";

/**
 * POST /api/agents/:id/run
 * 手动触发一轮完整循环（wake→context→think→decide→mood→emit），返回本轮最新日志。
 */
export const POST = withDb(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const agent = await agentRepo.getAgentById(id);
  if (!agent) return notFound("Agent");
  const result = await agentRuntime.runOnce(id);
  if (!result.ok) return badRequest(result.error ?? "运行失败");
  const latest = await journalRepo.getEntries(id, 5);
  return success({ cycle: result.cycle, journal: latest });
});

export { methodNotAllowed as GET };
