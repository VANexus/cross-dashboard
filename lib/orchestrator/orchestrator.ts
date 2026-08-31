/**
 * FlowMind AI Orchestrator — Core Engine
 *
 * The orchestration loop:
 *   1. User sends message
 *   2. AI sees available tools, decides which to call (tool_use)
 *   3. Backend executes selected tools
 *   4. Results fed back to AI for interpretation
 *   5. AI may chain more tools or produce final response
 *   6. All blocks streamed to frontend via AsyncGenerator
 *
 * Supports Claude (native tools) and OpenAI (native function calling).
 */

import { getAIProvider } from "@/lib/ai";
import { getAIConfig } from "@/lib/ai";
import type { OrchestratorBlock, StreamEvent, OrchestrateRequest } from "./types";
import { getToolById, toolsForAI } from "./tool-registry";

// ── System Prompt ────────────────────────────────────────────────

const SYSTEM_PROMPT = `你是 FlowMind 跨境电商智能编排助手。你可以通过调用工具来帮助用户完成各种跨境电商任务。

可用工具：
- competitor_analyze: 分析竞品 ASIN
- ad_analyze: 查看广告关键词表现
- ad_optimize: 优化广告策略
- listing_generate: 生成 Amazon Listing
- listing_category: 推荐产品类目
- listing_infringement: 检测侵权风险词
- imaging_generate: AI 生成产品图片
- inventory_restock: 库存补货建议
- product_research: 选品调研

工作原则：
1. 理解用户的自然语言意图，自动选择合适的工具
2. 如果信息不足，先用 options 向用户提问，而不是猜测
3. 执行工具后，用简洁的中文总结结果
4. 分析过程中发现新机会时，用 idea_bubble 建议下一步操作
5. 始终站在用户角度思考：用户想要什么结果？

回复风格：专业但友好，简洁有力，重点突出。`;

// ── Main Entry ───────────────────────────────────────────────────

export async function* orchestrate(
  request: OrchestrateRequest,
): AsyncGenerator<StreamEvent> {
  const { message, history = [], selectedOption } = request;
  const provider = await getAIProvider();

  // Build conversation messages
  const messages: { role: string; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-10).map((h) => ({ role: h.role, content: h.content })),
  ];

  // If user selected an option, inject context
  if (selectedOption) {
    messages.push({
      role: "system",
      content: `用户选择了选项：blockId=${selectedOption.blockId}, optionId=${selectedOption.optionId}。基于这个选择继续执行。`,
    });
  }

  messages.push({ role: "user", content: message });

  // Emit user message
  const userEvent: StreamEvent = {
    id: cryptoRandom(),
    role: "user",
    blocks: [{ type: "text", text: message }],
    finished: false,
    timestamp: Date.now(),
  };
  yield userEvent;

  // Run AI loop
  const assistantBlocks: OrchestratorBlock[] = [];
  const maxIterations = 5;
  let iteration = 0;

  try {
    while (iteration < maxIterations) {
      iteration++;

      // Claude or OpenAI: use native tool_use
      const aiResponse = await callAIWithTools(provider.name, messages, toolsForAI());

      // Add AI response to history
      messages.push({ role: "assistant", content: aiResponse.text });

      // Emit text block if present
      if (aiResponse.text) {
        const textBlock: OrchestratorBlock = { type: "text", text: aiResponse.text };
        assistantBlocks.push(textBlock);
        yield {
          id: cryptoRandom(),
          role: "assistant",
          blocks: [textBlock],
          finished: false,
          timestamp: Date.now(),
        };
      }

      // Process tool calls
      if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
        for (const tc of aiResponse.toolCalls) {
          const tool = getToolById(tc.name);
          if (!tool) {
            const errBlock: OrchestratorBlock = {
              type: "error",
              message: `未知工具: ${tc.name}`,
            };
            assistantBlocks.push(errBlock);
            yield {
              id: cryptoRandom(),
              role: "assistant",
              blocks: [errBlock],
              finished: false,
              timestamp: Date.now(),
            };
            continue;
          }

          // Emit tool_call pending
          const pendingBlock: OrchestratorBlock = {
            type: "tool_call",
            toolId: tc.name,
            toolName: tool.name,
            status: "running",
            params: tc.arguments,
            toolDescription: tool.description,
          };
          yield {
            id: cryptoRandom(),
            role: "assistant",
            blocks: [pendingBlock],
            finished: false,
            timestamp: Date.now(),
          };

          try {
            // Execute tool
            const result = await tool.execute(tc.arguments);

            // Emit tool_result
            const resultBlock: OrchestratorBlock = {
              type: "tool_result",
              toolId: tc.name,
              toolName: tool.name,
              summary: summarizeResult(tc.name, result),
              data: result,
            };
            assistantBlocks.push(resultBlock);
            yield {
              id: cryptoRandom(),
              role: "assistant",
              blocks: [resultBlock],
              finished: false,
              timestamp: Date.now(),
            };

            // Feed result back to AI
            messages.push({
              role: "system",
              content: `工具 ${tc.name} 执行完成，结果：${JSON.stringify(result).slice(0, 2000)}`,
            });

            // Emit idea bubbles based on result analysis
            const ideas = generateIdeaBubbles(tc.name, result);
            for (const idea of ideas) {
              assistantBlocks.push(idea);
              yield {
                id: cryptoRandom(),
                role: "assistant",
                blocks: [idea],
                finished: false,
                timestamp: Date.now(),
              };
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            const errBlock: OrchestratorBlock = {
              type: "error",
              message: `工具 ${tool.name} 执行失败: ${errMsg}`,
            };
            assistantBlocks.push(errBlock);
            yield {
              id: cryptoRandom(),
              role: "assistant",
              blocks: [errBlock],
              finished: false,
              timestamp: Date.now(),
            };

            messages.push({
              role: "system",
              content: `工具 ${tc.name} 执行失败: ${errMsg}`,
            });
          }
        }

        // Continue loop to let AI process results and potentially call more tools
        continue;
      }

      // No tool calls = final response
      break;
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    yield {
      id: cryptoRandom(),
      role: "system",
      blocks: [{ type: "error", message: `AI 调用失败: ${errMsg}` }],
      finished: false,
      timestamp: Date.now(),
    };
  }

  // Emit finished event
  yield {
    id: cryptoRandom(),
    role: "assistant",
    blocks: [],
    finished: true,
    timestamp: Date.now(),
  };
}

// ── AI Provider Calls ────────────────────────────────────────────

interface AIResponse {
  text: string;
  toolCalls?: { name: string; arguments: Record<string, unknown> }[];
}

async function callAIWithTools(
  providerName: string,
  messages: { role: string; content: string }[],
  tools: Record<string, unknown>[],
): Promise<AIResponse> {
  if (providerName === "claude") {
    return callClaudeWithTools(messages, tools);
  }
  if (providerName === "openai") {
    return callOpenAIWithTools(messages, tools);
  }
  throw new Error(`Unsupported provider: ${providerName}`);
}

async function callClaudeWithTools(
  messages: { role: string; content: string }[],
  tools: Record<string, unknown>[],
): Promise<AIResponse> {
  const config = await getAIConfig();
  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl || "https://api.anthropic.com";
  const model = config.model || "claude-sonnet-4-20250514";

  if (!apiKey) {
    throw new Error("Claude API Key 未配置，请在 设置 中配置后重试");
  }

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.7,
      system: messages.find((m) => m.role === "system")?.content,
      tools,
      messages: messages.filter((m) => m.role !== "system"),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} — ${err}`);
  }

  const data = (await response.json()) as {
    content: Array<{
      type: string;
      text?: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
  };

  let text = "";
  const toolCalls: { name: string; arguments: Record<string, unknown> }[] = [];

  for (const block of data.content) {
    if (block.type === "text" && block.text) {
      text += block.text;
    } else if (block.type === "tool_use" && block.name) {
      toolCalls.push({
        name: block.name,
        arguments: block.input || {},
      });
    }
  }

  return { text, toolCalls };
}

async function callOpenAIWithTools(
  messages: { role: string; content: string }[],
  tools: Record<string, unknown>[],
): Promise<AIResponse> {
  const config = await getAIConfig();
  const apiKey = config.apiKey;
  const baseUrl = (config.baseUrl || "https://api.openai.com").replace(/\/+$/, "");
  const model = config.model || "gpt-4o";

  if (!apiKey) {
    throw new Error("OpenAI API Key 未配置，请在 设置 中配置后重试");
  }

  const openAITools = tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.7,
      tools: openAITools,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} — ${err}`);
  }

  const data = (await response.json()) as {
    choices: Array<{
      message: {
        content: string | null;
        tool_calls?: Array<{
          function: { name: string; arguments: string };
        }>;
      };
    }>;
  };

  const msg = data.choices[0]?.message;
  const text = msg?.content || "";
  const toolCalls: { name: string; arguments: Record<string, unknown> }[] = [];

  if (msg?.tool_calls) {
    for (const tc of msg.tool_calls) {
      try {
        toolCalls.push({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        });
      } catch {
        toolCalls.push({
          name: tc.function.name,
          arguments: {},
        });
      }
    }
  }

  return { text, toolCalls };
}

// ── Helpers ──────────────────────────────────────────────────────

function summarizeResult(toolId: string, result: Record<string, unknown>): string {
  switch (toolId) {
    case "competitor_analyze":
      return `竞品分析完成，发现 ${Array.isArray(result.result) ? result.result.length : 1} 个竞品`;
    case "ad_analyze":
      return `共 ${(result.total as number) || 0} 个关键词`;
    case "ad_optimize":
      return `广告策略优化完成`;
    case "listing_generate":
      return `Listing 已生成，SEO 评分 ${((result.result as Record<string, unknown>)?.seoScore as number) || 0}`;
    case "imaging_generate":
      return `图片生成完成，共 ${Array.isArray(result.result) ? result.result.length : 0} 张`;
    case "inventory_restock":
      return `补货建议已生成`;
    case "product_research":
      return `选品调研完成`;
    default:
      return `${toolId} 执行完成`;
  }
}

function generateIdeaBubbles(
  toolId: string,
  _result: Record<string, unknown>,
): import("./types").IdeaBubbleBlock[] {
  const ideas: import("./types").IdeaBubbleBlock[] = [];

  // Generate contextual idea bubbles based on tool results
  if (toolId === "competitor_analyze") {
    ideas.push({
      type: "idea_bubble",
      text: "发现竞品 ACoS 偏高，建议优化广告策略",
      relatedTool: "ad_optimize",
      actionLabel: "优化广告",
      blockId: cryptoRandom(),
      params: { strategy: "balanced" },
    });
  }

  if (toolId === "ad_analyze") {
    ideas.push({
      type: "idea_bubble",
      text: "部分关键词 ACoS 过高，建议调整出价或暂停",
      relatedTool: "ad_optimize",
      actionLabel: "一键优化",
      blockId: cryptoRandom(),
      params: { strategy: "conservative" },
    });
  }

  if (toolId === "listing_generate") {
    ideas.push({
      type: "idea_bubble",
      text: "Listing 已就绪！建议生成配套产品图片",
      relatedTool: "imaging_generate",
      actionLabel: "生成图片",
      blockId: cryptoRandom(),
      params: { type: "main", count: 4 },
    });
  }

  return ideas;
}

function cryptoRandom(): string {
  // Simple unique ID (no crypto dependency for compatibility)
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
