import type { NextRequest } from "next/server";
import { z } from "zod";
import { withDb } from "@/lib/server/api-helpers";
import { success, notFound, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody } from "@/lib/server/api-validation";
import { AgentService } from "@/lib/server/services";

const service = new AgentService();

const schema = z.object({
  name: z.string().min(1).max(50),
  taskDescription: z.string().min(1).max(500),
});

/**
 * POST /api/agents/:id/spawn
 * 为父 Agent 派生子 Agent 并下发任务描述（进入 RAK 消息环）。
 */
export const POST = withDb(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const parsed = parseBody(schema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const sub = await service.spawnSubAgent(id, parsed.data.name, parsed.data.taskDescription);
  if (!sub) return notFound("Agent");
  return success(sub);
});

export { methodNotAllowed as GET };
