/**
 * lib/server/ai/sdk-provider.ts — 全栈统一 LLM Provider（单一出口）
 *
 * 规范统一：全栈所有 LLM 调用只依赖「AI SDK（Vercel AI SDK）＋ 一份配置 readConfig()」，
 * 不再有手写 fetch 的 OpenAIProvider/ClaudeAIProvider 两套实现。
 *
 * 本类实现 AIProvider 接口（真脑 / 编排 / workflow.service 的 generate・analyze），
 * 内部统一走注入的 LanguageModel 工厂（由 index.ts 提供 getAISDKModel，避免循环依赖）：
 *   - generate           → generateText（文本）
 *   - analyze            → generateText + 结构化 JSON 解析（兼容小模型带围栏/前后废话）
 *   - generateWithTools  → 保留接口（当前无调用方）；真需要时用 ai-sdk 的 generateText(tools)
 */
import { generateText } from "ai";
import type { LanguageModel } from "ai";
import type {
  AIProvider,
  GenerateParams,
  GenerateResult,
  AnalyzeParams,
  GenerateWithToolsParams,
  GenerateWithToolsResult,
} from "./provider";

const ANALYSIS_SYSTEM =
  "You are a data analysis assistant. Always respond with valid JSON, no markdown fences.";

/** 兼容小模型：截取首个 { 到最后一个 } 作为 JSON。 */
function extractJson(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw;
}

export class SdkAIProvider implements AIProvider {
  readonly name = "sdk";

  constructor(private modelFactory: () => Promise<LanguageModel>) {}

  private async model(): Promise<LanguageModel> {
    return await this.modelFactory();
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const start = Date.now();
    const model = await this.model();
    const res = await generateText({
      model,
      system: params.system ?? "You are a helpful cross-border e-commerce AI assistant.",
      prompt: params.prompt,
      ...(params.temperature != null ? { temperature: params.temperature } : {}),
      ...(params.maxTokens != null ? { maxOutputTokens: params.maxTokens } : {}),
    });
    return {
      content: res.text,
      usage: {
        input: res.usage?.inputTokens ?? 0,
        output: res.usage?.outputTokens ?? 0,
      },
      model: (res as { modelId?: string }).modelId ?? getModelName(res),
      latency: Date.now() - start,
    };
  }

  async analyze<T>(params: AnalyzeParams): Promise<T> {
    const model = await this.model();
    const prompt = `${params.prompt}\n\nData:\n${JSON.stringify(params.data, null, 2)}\n\n${
      params.schema ? `Respond with JSON matching this schema: ${params.schema}` : "Respond with JSON."
    }`;
    const res = await generateText({
      model,
      system: ANALYSIS_SYSTEM,
      prompt,
      temperature: 0.3,
    });
    try {
      return JSON.parse(res.text) as T;
    } catch {
      try {
        return JSON.parse(extractJson(res.text)) as T;
      } catch {
        return { content: res.text } as unknown as T;
      }
    }
  }

  /** 保留接口（当前无调用方）。需要时用 ai-sdk generateText + tools 实现。 */
  async generateWithTools(params: GenerateWithToolsParams): Promise<GenerateWithToolsResult> {
    const model = await this.model();
    await generateText({
      model,
      messages: params.messages.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
    });
    return { text: "", toolCalls: [] };
  }
}

function getModelName(res: unknown): string {
  const model =
    res && typeof res === "object" && (res as { model?: string }).model;
  return typeof model === "string" && model.length > 0 ? model : "sdk";
}