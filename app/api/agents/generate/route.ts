import { NextRequest } from "next/server";
import { z } from "zod";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest } from "@/lib/server/api-response";
import { parseBody } from "@/lib/server/api-validation";
import { generateAgentFromPrompt, persistGeneratedAgent } from "@/lib/server/agent-runtime/agent-factory";
import { ensurePresetTemplates } from "@/lib/server/agent-runtime/templates";

const schema = z.object({
  prompt: z.string().min(2).max(500).describe("一句话描述想要的 Agent"),
  referenceTemplateIds: z.array(z.string()).optional().describe("重点参考的预设模板 id"),
});

/**
 * 一句话动态生成完整 Agent（LLM 生成独立人格配置 → 落库 → 启动运行时节律）。
 * 零 mock：AI 未配置返回 400 AI_CONFIG。
 */
export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(schema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);

  try {
    await ensurePresetTemplates();
    const generated = await generateAgentFromPrompt(parsed.data.prompt, {
      referenceTemplateIds: parsed.data.referenceTemplateIds,
    });
    const agentId = await persistGeneratedAgent(generated);
    return success({
      id: agentId,
      name: generated.name,
      type: generated.type,
      description: generated.description,
      source: "generated",
      systemPrompt: generated.config.persona.systemPrompt,
      expertise: generated.config.persona.expertise,
    });
  } catch (e) {
    const err = e as { name?: string; message?: string };
    if (err.name === "AIConfigError") {
      return badRequest("AI_CONFIG：" + (err.message ?? "模型网关未就绪"));
    }
    return badRequest(`Agent 生成失败：${err.message ?? String(e)}`);
  }
});
