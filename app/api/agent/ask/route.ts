// app/api/agent/ask/route.ts
// 锚定问答端点:POST { question, context } → SSE(meta | delta* | done | error) 流。
// P4 收编:内部实现从手写 provider.generate（伪流式分片）切换为 AI SDK streamText(getAISDKModel),
// SSE 事件契约(meta/delta/done/error)保持不变,drawer 前端无感。
//  - 未配置 key → 流式返回 error 事件(AI_CONFIG),前端展示配置引导,绝不伪造回答;
//  - 已配置   → 真实流式生成,按 delta 逐段下发。
import { NextRequest } from "next/server";
import { streamText } from "ai";
import { AIConfigError, getAIConfig } from "@/lib/ai";
import { getKernel } from "@/src/kernel";

export const maxDuration = 60;

interface AskBody {
  question?: string;
  context?: { page?: string; selection?: string };
}

const SYSTEM_PROMPT =
  "你是 FlowMind 跨境电商系统的内嵌运营 Agent。用简体中文回答,只基于给定上下文与常识,结论先行,不超过 200 字,可用 ①②③ 列点。不要编造数据;缺少数据时明确说明。";

export async function POST(req: NextRequest) {
  let body: AskBody;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const question = (body.question ?? "").trim();
  const ctxLabel = [body.context?.page, body.context?.selection].filter(Boolean).join(" · ");
  const prompt = ctxLabel
    ? `当前页面上下文:${ctxLabel}\n用户问题:${question}`
    : (question || "你好");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const push = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const [model, config] = await Promise.all([(await getKernel()).aiModel.get(), getAIConfig()]);

        let streamError: unknown = null;
        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          prompt,
          onError: ({ error }) => {
            streamError = error;
          },
        });

        push("meta", { agent: config.provider, model: config.model });

        for await (const delta of result.textStream) {
          push("delta", { text: delta });
        }
        if (streamError) throw streamError;

        const usage = await result.usage;
        push("done", {
          usage: { input: usage.inputTokens ?? 0, output: usage.outputTokens ?? 0 },
        });
      } catch (err) {
        if (err instanceof AIConfigError) {
          push("error", { code: "AI_CONFIG", message: err.message });
        } else {
          push("error", {
            code: "AI_FAILED",
            message: "生成失败,请稍后重试(" + (err instanceof Error ? err.name : "unknown") + ")",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
