/**
 * FlowMind RAK — Claude AI Provider
 * Anthropic Claude API integration
 */
import type { AIProvider, GenerateParams, GenerateResult, AnalyzeParams } from "./provider";

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
        "x-api-key": this.apiKey,
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
      content: { type: string; text: string }[];
      usage: { input_tokens: number; output_tokens: number };
      model: string;
    };

    return {
      content: data.content[0]?.text ?? "",
      usage: { input: data.usage.input_tokens, output: data.usage.output_tokens },
      model: data.model,
      latency: Date.now() - start,
    };
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
