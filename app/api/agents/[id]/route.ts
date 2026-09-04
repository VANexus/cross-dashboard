import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, notFound, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { AgentService } from "@/lib/server/services";
import * as agentRepo from "@/lib/server/repositories/agent.repository";
import type { AgentConfig } from "@/lib/shared/types";

const service = new AgentService();

export const GET = withDb(async (_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const agent = await service.getById(id);
  if (!agent) return notFound("Agent");
  return success(agent);
});

export const PATCH = withDb(async (request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const agent = await agentRepo.getAgentById(id);
  if (!agent) return notFound("Agent");

  try {
    const body = await request.json() as Partial<AgentConfig>;
    const current = agent.config;
    if (!current) return badRequest("Agent has no config");

    const updated: AgentConfig = {
      persona: { ...current.persona, ...body.persona },
      goals: body.goals ?? current.goals,
      mood: body.mood ?? current.mood,
      cycleConfig: { ...current.cycleConfig, ...body.cycleConfig },
    };

    await agentRepo.updateAgentConfig(id, updated);
    return success(updated);
  } catch {
    return badRequest("Invalid request body");
  }
});

export const DELETE = withDb(async (_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const agent = await agentRepo.getAgentById(id);
  if (!agent) return notFound("Agent");
  // 停止运行时节律（若在跑）
  const { agentRuntime } = await import("@/lib/server/agent-runtime/runtime");
  agentRuntime.stopAgent(id);
  await agentRepo.deleteAgent(id);
  return success({ id, deleted: true });
});

export { methodNotAllowed as POST };