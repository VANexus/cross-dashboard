/**
 * POST /api/agent/context-stats
 * body: { messages: UIMessage[], pageContext?, agentId? } —— 与 /api/agent/chat 同构。
 *
 * 复算 Agent 对话即将送入模型的上下文组成：
 *   persona（系统人格）/ page（页面上下文）/ memory（语义记忆召回）/ history（对话历史）/ tools（工具定义）
 * 及总占用占模型上下文窗口的百分比。
 * 口径与 chat 路由完全同源（共用 lib/server/agent/chat-context），前端抽屉用它渲染「上下文」展开卡。
 */
import { NextRequest } from "next/server";
import type { UIMessage } from "ai";
import { withDb } from "@/lib/server/api-helpers";
import { getKernel } from "@/src/kernel";
import { resolveAgentIdentity, buildMemoryAugment } from "@/lib/server/agent/memory-augment";
import {
  buildContextParts,
  extractLastUserText,
  type PageContext,
} from "@/lib/server/agent/chat-context";
import {
  computeContextStats,
  estimateToolSetTokens,
  estimateUIMessagesTokens,
} from "@/lib/server/agent/context-stats";

/** 模型上下文窗口（token）。来自 env，默认 32768（Qwen3.x-4B 常见 32k）。 */
function contextWindow(): number {
  const raw = process.env.AI_CONTEXT_WINDOW;
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? n : 32768;
}

export const POST = withDb(async (request: NextRequest) => {
  const body = (await request.json().catch(() => ({}))) as {
    messages?: UIMessage[];
    pageContext?: PageContext;
    agentId?: string;
  };

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return Response.json({ ok: true, stats: null, window: contextWindow() });
  }

  const window = contextWindow();
  const { persona, page } = buildContextParts(body.pageContext);

  // 与 chat 路由同源：绑定 Agent 身份 + 语义记忆召回（query 取最近一条用户文本）
  let memory = "";
  try {
    const identity = await resolveAgentIdentity(body.agentId);
    const lastUserText = extractLastUserText(messages);
    const augment = await buildMemoryAugment({ identity, query: lastUserText });
    memory = augment.block ?? "";
  } catch (e) {
    // 记忆层故障不阻断统计：memory 记 0 并继续
    console.error("[context-stats] memory augment", e);
  }

  // 工具定义 token：与 chat 一致地转换 AI SDK ToolSet（无 outcome 回调，仅用于计量）
  let toolsTokens = 0;
  try {
    const kernel = await getKernel();
    toolsTokens = estimateToolSetTokens(kernel.tools.toAiSdkTools());
  } catch (e) {
    console.error("[context-stats] tools", e);
  }
  // 对话历史 token：直接估算原始 UIMessage[]（估算口径，无需模型格式转换）
  const historyTokens = estimateUIMessagesTokens(messages);

  const stats = computeContextStats({
    persona,
    page,
    memory,
    historyTokens,
    toolsTokens,
    window,
  });

  return Response.json({ ok: true, stats, window });
});
