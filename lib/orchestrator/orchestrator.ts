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
 * Falls back to keyword-based tool selection for mock/demo mode.
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
  const provider = getAIProvider();
  const config = getAIConfig();

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

      if (provider.name === "mock") {
        // Mock mode: keyword-based tool selection
        const mockBlocks = await runMockMode(message, config.demoMode);
        for (const block of mockBlocks) {
          assistantBlocks.push(block);
          yield {
            id: cryptoRandom(),
            role: "assistant",
            blocks: [block],
            finished: false,
            timestamp: Date.now(),
          };
        }
        break;
      }

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
  const config = getAIConfig();
  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl || "https://api.anthropic.com";
  const model = config.model || "claude-sonnet-4-20250514";

  if (!apiKey || apiKey === "mock") {
    throw new Error("Claude API Key 未配置");
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
  const config = getAIConfig();
  const apiKey = config.apiKey;
  const baseUrl = (config.baseUrl || "https://api.openai.com").replace(/\/+$/, "");
  const model = config.model || "gpt-4o";

  if (!apiKey || apiKey === "mock") {
    throw new Error("OpenAI API Key 未配置");
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

// ── Mock Mode ────────────────────────────────────────────────────

async function runMockMode(
  message: string,
  _demoMode?: boolean,
): Promise<OrchestratorBlock[]> {
  const blocks: OrchestratorBlock[] = [];
  const lower = message.toLowerCase();

  blocks.push({
    type: "text",
    text: `我正在分析你的请求：「${message}」`,
  });

  // Keyword-based tool selection
  if (lower.includes("竞品") || lower.includes("asin") || lower.includes("对手")) {
    blocks.push({
      type: "tool_call",
      toolId: "competitor_analyze",
      toolName: "竞品分析",
      status: "running",
      toolDescription: "分析竞品 ASIN 数据",
    });

    blocks.push({
      type: "tool_result",
      toolId: "competitor_analyze",
      toolName: "竞品分析",
      summary: "发现 3 个主要竞品，BSR 排名 #3，价格区间 $25-45",
      data: {
        competitors: [
          { asin: "B08N5WRWNW", rank: 3, price: 29.99, rating: 4.5 },
          { asin: "B09XYZ1234", rank: 7, price: 35.5, rating: 4.3 },
          { asin: "B07ABC5678", rank: 12, price: 24.99, rating: 4.1 },
        ],
      },
    });

    blocks.push({
      type: "idea_bubble",
      text: "发现竞品 ACoS 偏高（28%），建议优化广告策略降低至 15%",
      relatedTool: "ad_optimize",
      actionLabel: "优化广告",
      blockId: cryptoRandom(),
      params: { strategy: "balanced", target_acos: 15 },
    });
  } else if (lower.includes("广告") || lower.includes("acos") || lower.includes("关键词")) {
    blocks.push({
      type: "tool_call",
      toolId: "ad_analyze",
      toolName: "广告关键词分析",
      status: "running",
    });

    blocks.push({
      type: "tool_result",
      toolId: "ad_analyze",
      toolName: "广告关键词分析",
      summary: "共 15 个关键词，平均 ACoS 22.3%，3 个高花费低转化词需优化",
      data: {
        keywords: [
          { keyword: "pet water fountain", spend: 156, sales: 420, acos: 37.1, conversion: 8.2 },
          { keyword: "cat fountain", spend: 89, sales: 310, acos: 28.7, conversion: 12.1 },
          { keyword: "automatic pet waterer", spend: 45, sales: 180, acos: 25.0, conversion: 15.3 },
        ],
      },
    });

    blocks.push({
      type: "idea_bubble",
      text: "「pet water fountain」ACoS 37% 过高，建议降低出价或暂停",
      relatedTool: "ad_optimize",
      actionLabel: "一键优化",
      blockId: cryptoRandom(),
      params: { keywords: "pet water fountain", strategy: "conservative" },
    });
  } else if (lower.includes("listing") || lower.includes("上架") || lower.includes("标题")) {
    blocks.push({
      type: "tool_call",
      toolId: "listing_generate",
      toolName: "Listing 生成",
      status: "running",
    });

    blocks.push({
      type: "tool_result",
      toolId: "listing_generate",
      toolName: "Listing 生成",
      summary: "已生成高转化 Listing，预估 CTR 提升 15%",
      data: {
        title: "Smart Pet Fountain Pro — UV Sterilization, Ultra-Quiet, 3L Capacity",
        bullets: [
          "Advanced UV-C Sterilization — 99.9% bacteria elimination",
          "Ultra-Quiet DC Motor — Under 30dB operation",
          "3L Large Capacity — Perfect for multi-pet households",
          "Smart Temperature Display — Real-time LED monitoring",
          "Tool-Free Cleaning — Disassembles in seconds",
        ],
        seoScore: 92,
      },
    });

    blocks.push({
      type: "idea_bubble",
      text: "Listing 已就绪！建议同时生成配套产品图片",
      relatedTool: "imaging_generate",
      actionLabel: "生成图片",
      blockId: cryptoRandom(),
      params: { prompt: "Smart Pet Fountain Pro product photo, white background, studio lighting", type: "main", count: 4 },
    });
  } else if (lower.includes("图") || lower.includes("photo") || lower.includes("image")) {
    blocks.push({
      type: "tool_call",
      toolId: "imaging_generate",
      toolName: "AI 作图",
      status: "running",
    });

    blocks.push({
      type: "tool_result",
      toolId: "imaging_generate",
      toolName: "AI 作图",
      summary: "已生成 4 张产品图，2 张评分 85+（推荐使用）",
      data: {
        images: [
          { type: "main", score: 88, isBest: true },
          { type: "main", score: 91, isBest: true },
          { type: "main", score: 72, isBest: false },
          { type: "main", score: 65, isBest: false },
        ],
      },
    });
  } else if (lower.includes("库存") || lower.includes("补货") || lower.includes("restock")) {
    blocks.push({
      type: "tool_call",
      toolId: "inventory_restock",
      toolName: "库存补货建议",
      status: "running",
    });

    blocks.push({
      type: "tool_result",
      toolId: "inventory_restock",
      toolName: "库存补货建议",
      summary: "3 个 SKU 需要补货，预估总成本 $2,400",
      data: {
        suggestions: [
          { sku: "PF-001", name: "Pet Fountain Pro", daysLeft: 12, quantity: 200, urgency: "high" },
          { sku: "PF-002", name: "Filter Replacement", daysLeft: 18, quantity: 500, urgency: "medium" },
          { sku: "FT-003", name: "Cat Feeder Mini", daysLeft: 25, quantity: 150, urgency: "medium" },
        ],
      },
    });
  } else if (lower.includes("选品") || lower.includes("调研") || lower.includes("product research")) {
    blocks.push({
      type: "tool_call",
      toolId: "product_research",
      toolName: "选品调研",
      status: "running",
    });

    blocks.push({
      type: "tool_result",
      toolId: "product_research",
      toolName: "选品调研",
      summary: "发现 3 个高潜力品类，推荐指数 85+",
      data: {
        opportunities: [
          { name: "Interactive Cat Toys", score: 88, trend: "upward", competition: "medium" },
          { name: "Smart Pet Cameras", score: 76, trend: "upward", competition: "high" },
          { name: "Pet Grooming Tools", score: 82, trend: "stable", competition: "low" },
        ],
      },
    });
  } else {
    // General response with options
    blocks.push({
      type: "text",
      text: "我可以帮你完成以下任务，请选择或描述你的需求：",
    });

    blocks.push({
      type: "options",
      question: "你想做什么？",
      blockId: cryptoRandom(),
      options: [
        { id: "competitor", label: "分析竞品", description: "输入 ASIN 分析竞品数据", icon: "Search" },
        { id: "listing", label: "生成 Listing", description: "AI 生成标题/五点/描述", icon: "FileText" },
        { id: "ad", label: "优化广告", description: "降低 ACoS 提升转化", icon: "TrendingUp" },
        { id: "imaging", label: "AI 作图", description: "生成产品主图/场景图", icon: "Image" },
      ],
    });
  }

  return blocks;
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
