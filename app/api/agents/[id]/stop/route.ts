import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, notFound, methodNotAllowed } from "@/lib/server/api-response";
import { agentRuntime } from "@/lib/server/agent-runtime/runtime";
import * as agentRepo from "@/lib/server/repositories/agent.repository";

/**
 * POST /api/agents/:id/stop
 * 停止该 Agent 的运行时节律（幂等）。状态置 offline。
 */
export const POST = withDb(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const agent = await agentRepo.getAgentById(id);
  if (!agent) return notFound("Agent");
  agentRuntime.stopAgent(id);
  await agentRepo.updateAgentStatus(id, "offline");
  return success({ id, running: false });
});

export { methodNotAllowed as GET };
