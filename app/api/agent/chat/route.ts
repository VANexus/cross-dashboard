/**
 * Web Agent 统一对话端点（P1b — 前端即 Agent）
 *
 * POST /api/agent/chat
 * body: { messages: UIMessage[], pageContext?: { route, title, snapshot, state?, actions } }
 * 响应：AI SDK UIMessage stream（result.toUIMessageStreamResponse()）。
 *
 * - system prompt：运营助手人设 + pageContext 注入（页面上下文 / UI 状态 / 可用页面动作）；
 * - tools：
 *   - ui_action：client-side tool（不定义 execute）——模型发起调用后随流下发，
 *     由前端 addToolResult 回传执行结果再发起下一轮请求；
 *   - Mastra tools：lib/mastra 并行开发中，动态 import 弱依赖（存在则注册，否则跳过）。
 */
import { NextRequest } from "next/server";
import {
  streamText,
  convertToModelMessages,
  tool,
  type UIMessage,
  type LanguageModel,
  type ToolSet,
} from "ai";
import { z } from "zod";
import { withDb } from "@/lib/api-helpers";
import { AIConfigError, getAISDKModel } from "@/lib/ai";

export const maxDuration = 60;

interface PageAction {
  id: string;
  description: string;
}

interface PageContext {
  route?: string;
  title?: string;
  snapshot?: string;
  state?: Record<string, unknown>;
  actions?: PageAction[];
}

interface ChatBody {
  messages?: UIMessage[];
  pageContext?: PageContext;
}

const BASE_PERSONA = `你是 FlowMind 跨境电商系统的运营助手。用简体中文交流，结论先行，可用 ①②③ 列点。
不要编造数据；缺少数据时明确说明，并建议用户前往对应页面查看或补充。
用户的问题可能涉及当前页面内容与页面上的可执行动作。`;

/** client-side tool：不定义 execute，调用权在前端（前端 addToolResult 回传）。 */
const uiActionTool = tool({
  description: "执行用户当前页面上的 UI 操作",
  inputSchema: z.object({
    id: z.string().describe("页面动作 id，取自 system 提示中的「可调用页面动作」列表"),
    params: z.record(z.string(), z.unknown()).optional().describe("动作参数（可选）"),
  }),
});

// P1c: Mastra 工具并行开发中（lib/mastra 可能尚不存在）。
// 动态 import 弱依赖：模块存在且导出 mastraTools（ToolSet）时自动注册，否则静默跳过。
const MASTRA_TOOLS_MODULE = "@/lib/mastra";

async function loadMastraTools(): Promise<ToolSet> {
  try {
    const mod = (await import(MASTRA_TOOLS_MODULE)) as { mastraTools?: ToolSet };
    return mod.mastraTools ?? {};
  } catch {
    return {};
  }
}

function buildSystemPrompt(pageContext?: PageContext): string {
  if (!pageContext) return BASE_PERSONA;

  const lines: string[] = [
    BASE_PERSONA,
    "",
    "## 用户当前页面",
    `用户当前在「${pageContext.title ?? "未知页面"}」(${pageContext.route ?? "未知路由"})。`,
  ];

  if (pageContext.snapshot) {
    lines.push("页面数据摘要：", pageContext.snapshot);
  }
  if (pageContext.state && Object.keys(pageContext.state).length > 0) {
    lines.push("页面 UI 状态：", JSON.stringify(pageContext.state, null, 2));
  }
  if (pageContext.actions && pageContext.actions.length > 0) {
    lines.push(
      "可调用以下页面动作（通过 ui_action 工具触发，由前端在页面上执行，不要编造列表之外的 id）：",
      ...pageContext.actions.map((a) => `- ${a.id} — ${a.description}`),
    );
  }

  return lines.join("\n");
}

export const POST = withDb(async (request: NextRequest) => {
  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    body = {};
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return Response.json({ error: "messages is required" }, { status: 400 });
  }

  let model: LanguageModel;
  try {
    model = await getAISDKModel();
  } catch (err) {
    if (err instanceof AIConfigError) {
      return Response.json({ error: "AI_CONFIG", message: err.message }, { status: 400 });
    }
    throw err;
  }

  const tools: ToolSet = { ui_action: uiActionTool, ...(await loadMastraTools()) };

  const result = streamText({
    model,
    system: buildSystemPrompt(body.pageContext),
    messages: await convertToModelMessages(messages, { tools }),
    tools,
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[agent/chat]", error);
      return error instanceof AIConfigError ? error.message : "生成失败，请稍后重试";
    },
  });
});
