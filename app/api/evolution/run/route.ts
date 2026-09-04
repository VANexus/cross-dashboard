import type { NextRequest } from "next/server";
import { z } from "zod";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody } from "@/lib/server/api-validation";
import { evolutionEngine } from "@/lib/server/services/evolution-engine.service";
import * as agentRepo from "@/lib/server/repositories/agent.repository";

const schema = z.object({
  agentId: z.string().min(1),
});

/**
 * POST /api/evolution/run
 * 手动触发一次完整自进化管道（identify→generate→test→review→reuse）。
 * 返回：进化记录 + 五阶段 + before/after 真实指标；被锁跳过时 skipped=true。
 */
export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(schema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const agent = await agentRepo.getAgentById(parsed.data.agentId);
  if (!agent) return badRequest("Agent 不存在");
  const result = await evolutionEngine.run({ agentId: parsed.data.agentId, source: "manual" });
  if (result.skipped) {
    return success({ skipped: true, reason: result.reason ?? "lock_held" });
  }
  return success(result);
});

export { methodNotAllowed as GET };
