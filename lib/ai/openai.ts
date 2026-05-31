/**
 * FlowMind RAK — OpenAI Provider
 * OpenAI-compatible API integration (works with any OpenAI-compatible endpoint)
 */
import type { AIProvider, GenerateParams, GenerateResult, AnalyzeParams, ImageParams, ImageResult } from "./provider";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private apiKey: string;
  private defaultModel: string;
  private baseUrl: string;

  constructor(config: { apiKey: string; model?: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.defaultModel = config.model ?? "gpt-4o";
    this.baseUrl = (config.baseUrl ?? "https://api.openai.com").replace(/\/+$/, "");
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const start = Date.now();
    const model = params.model ?? this.defaultModel;

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0.7,
        messages: [
          { role: "system", content: params.system ?? "You are a helpful cross-border e-commerce AI assistant." },
          { role: "user", content: params.prompt },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} — ${error}`);
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[];
      usage: { prompt_tokens: number; completion_tokens: number };
      model: string;
    };

    return {
      content: data.choices[0]?.message?.content ?? "",
      usage: { input: data.usage.prompt_tokens, output: data.usage.completion_tokens },
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
