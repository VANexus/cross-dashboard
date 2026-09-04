import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, notFound, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { agentRuntime } from "@/lib/server/agent-runtime/runtime";
import * as agentRepo from "@/lib/server/repositories/agent.repository";

/**
 * POST /api/agents/:id/start
 * 启动该 Agent 的运行时节律（幂等）。
 */
export const POST = withDb(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const agent = await agentRepo.getAgentById(id);
  if (!agent) return notFound("Agent");
  await agentRuntime.startAgent(id);
  await agentRepo.updateAgentStatus(id, "online");
  return success({ id, running: true });
});

export { methodNotAllowed as GET };
