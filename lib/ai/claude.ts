/**
 * FlowMind RAK — Claude AI Provider
 * Anthropic Claude API integration
 */
import type {
  AIProvider,
  GenerateParams,
  GenerateResult,
  AnalyzeParams,
  GenerateWithToolsParams,
  GenerateWithToolsResult,
} from "./provider";

export class ClaudeAIProvider implements AIProvider {
  readonly name = "claude";
  private apiKey: string;
  private defaultModel: string;
  private baseUrl: string;

  constructor(config: { apiKey: string; model?: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.defaultModel = config.model ?? "claude-sonnet-4-20250514";
    this.baseUrl = config.baseUrl ?? "https://api.anthropic.com";
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const start = Date.now();
    const model = params.model ?? this.defaultModel;

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 双鉴权头：Anthropic 官方走 x-api-key；LongCat 等 Anthropic 兼容网关走 Bearer
        "x-api-key": this.apiKey,
        Authorization: `Bearer ${this.apiKey}`,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0.7,
        system: params.system ?? "You are a helpful cross-border e-commerce AI assistant.",
        messages: [{ role: "user", content: params.prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} — ${error}`);
    }

    const data = await response.json() as {
      content: { type: string; text?: string }[];
      usage: { input_tokens: number; output_tokens: number };
      model: string;
    };

    // 兼容 LongCat 等网关：content 首块可能是 thinking，正文取全部 text 块拼接
    const text = data.content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("");
    if (!text) {
      throw new Error("模型未返回正文（可能全部消耗在思考块上），请增大 max_tokens 后重试");
    }

    return {
      content: text,
      usage: { input: data.usage.input_tokens, output: data.usage.output_tokens },
      model: data.model,
      latency: Date.now() - start,
    };
  }

  /**
   * 原生 tool_use 一轮（编排器工具循环）。
   * - 双鉴权头：Anthropic 官方走 x-api-key；LongCat 等 Anthropic 兼容网关走 Bearer；
   * - thinking 块过滤：只取 text 块拼正文，tool_use 单独收集（LongCat 网关可能返回思考块）。
   */
  async generateWithTools(params: GenerateWithToolsParams): Promise<GenerateWithToolsResult> {
    if (!this.apiKey) {
      throw new Error("Claude API Key 未配置，请在 设置 中配置后重试");
    }
    const model = params.model ?? this.defaultModel;

    // Claude API 不允许会话中间插 system 消息：合并全部 system 内容作 system 参数
    const system = params.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 双鉴权头：Anthropic 官方走 x-api-key；LongCat 等 Anthropic 兼容网关走 Bearer
        "x-api-key": this.apiKey,
        Authorization: `Bearer ${this.apiKey}`,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0.7,
        system: system || undefined,
        tools: params.tools,
        messages: params.messages.filter((m) => m.role !== "system"),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} — ${error}`);
    }

    const data = await response.json() as {
      content: Array<{
        type: string;
        text?: string;
        name?: string;
        input?: Record<string, unknown>;
      }>;
    };

    // thinking 块过滤：正文只拼 text 块；tool_use 收集为调用列表
    let text = "";
    const toolCalls: { name: string; arguments: Record<string, unknown> }[] = [];

    for (const block of data.content) {
      if (block.type === "text" && block.text) {
        text += block.text;
      } else if (block.type === "tool_use" && block.name) {
        toolCalls.push({ name: block.name, arguments: block.input || {} });
      }
    }

    return { text, toolCalls };
  }

  async analyze<T>(params: AnalyzeParams): Promise<T> {
    const prompt = `${params.prompt}\n\nData:\n${JSON.stringify(params.data, null, 2)}\n\n${params.schema ? `Respond with JSON matching this schema: ${params.schema}` : "Respond with JSON."}`;

    const result = await this.generate({
      prompt,
      system: "You are a data analysis assistant. Always respond with valid JSON.",
      temperature: 0.3,
    });

    try {
      return JSON.parse(result.content) as T;
    } catch {
      return result.content as unknown as T;
    }
  }
}
