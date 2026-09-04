import { NextRequest } from "next/server";
import { z } from "zod";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest } from "@/lib/server/api-response";
import { parseBody } from "@/lib/server/api-validation";
import * as teamRepo from "@/lib/server/repositories/team.repository";
import { generateTeamFromPrompt, persistGeneratedAgent } from "@/lib/server/agent-runtime/agent-factory";
import { ensurePresetTemplates } from "@/lib/server/agent-runtime/templates";

/** 团队列表。 */
export const GET = withDb(async () => {
  const data = await teamRepo.listTeams();
  return success(data);
});

const createSchema = z.object({
  name: z.string().min(1).max(50),
  goal: z.string().min(1).max(200).optional(),
  memberAgentIds: z.array(z.string()).optional(),
  leaderAgentId: z.string().optional(),
});

const generateSchema = z.object({
  prompt: z.string().min(2).max(500).describe("一句话描述团队目标"),
});

/**
 * POST：创建团队（显式指定成员）或一句话动态生成团队（LLM 生成 N 个 Agent + 团队）。
 * body 含 prompt → 动态生成；否则按 name/memberAgentIds 显式创建。
 */
export const POST = withDb(async (request: NextRequest) => {
  const body = await request.json().catch(() => ({}));
  if (typeof body === "object" && body !== null && typeof (body as { prompt?: string }).prompt === "string") {
    const parsed = parseBody(generateSchema, body);
    if (!parsed.success) return badRequest(parsed.error);
    try {
      await ensurePresetTemplates();
      const { team, agents } = await generateTeamFromPrompt(parsed.data.prompt);
      const memberIds: string[] = [];
      for (const g of agents) {
        memberIds.push(await persistGeneratedAgent(g));
      }
      const t = await teamRepo.createTeam({
        name: team.name,
        goal: team.goal,
        memberAgentIds: memberIds,
        leaderAgentId: memberIds[0] ?? null,
      });
      return success({
        ...t,
        generatedAgents: agents.map((a, i) => ({ id: memberIds[i], name: a.name, type: a.type })),
      });
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name === "AIConfigError") return badRequest("AI_CONFIG：" + (err.message ?? "模型网关未就绪"));
      return badRequest(`团队生成失败：${err.message ?? String(e)}`);
    }
  }

  const parsed = parseBody(createSchema, body);
  if (!parsed.success) return badRequest(parsed.error);
  const team = await teamRepo.createTeam({
    name: parsed.data.name,
    goal: parsed.data.goal ?? parsed.data.name,
    memberAgentIds: parsed.data.memberAgentIds,
    leaderAgentId: parsed.data.leaderAgentId ?? parsed.data.memberAgentIds?.[0] ?? null,
  });
  return success(team);
});
