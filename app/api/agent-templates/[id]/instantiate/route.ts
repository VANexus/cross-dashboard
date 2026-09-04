import { NextRequest } from "next/server";
import { z } from "zod";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest } from "@/lib/server/api-response";
import { parseBody } from "@/lib/server/api-validation";
import { listTemplates } from "@/lib/server/agent-runtime/templates";
import * as agentRepo from "@/lib/server/repositories/agent.repository";
import { agentRuntime } from "@/lib/server/agent-runtime/runtime";
import type { AgentConfig } from "@/lib/shared/types";

/** 模板实例化：把一个预设模板创建为运行中的 Agent。 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const schema = z.object({ name: z.string().min(1).max(50).optional() });
  const parsed = parseBody(schema, await request.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error);

  const templates = await listTemplates();
  const template = templates.find((t) => t.id === id);
  if (!template) return badRequest(`模板 ${id} 不存在`);

  const existing = await agentRepo.getAgents({ type: template.type });
  const seq = String(existing.length + 1).padStart(3, "0");
  const agentId = `${template.type}-${seq}`;
  const config: AgentConfig = {
    persona: {
      systemPrompt: template.config.persona.systemPrompt,
      communicationStyle: template.config.persona.communicationStyle,
      expertise: template.config.persona.expertise,
    },
    goals: template.config.goals.map((g) => ({
      ...g,
      id: g.id.startsWith(agentId) ? g.id : `${agentId}-${g.id.slice(-6)}`,
    })),
    mood: template.config.mood,
    cycleConfig: template.config.cycleConfig,
  };
  const agent = await agentRepo.createAgent({
    id: agentId,
    name: parsed.data.name ?? `${template.name}·${seq}`,
    type: template.type,
    description: template.description,
    config,
    status: "online",
  });
  void agentRuntime.startAgent(agentId).catch(console.error);
  return success({ ...agent, source: "preset" });
}
