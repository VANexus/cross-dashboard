/**
 * FlowMind RAK — AI Provider Factory
 * Manages provider lifecycle and reads config from ai_config database table.
 * Supports frontend-configurable provider switching without env vars.
 * 配置优先级：ai_config 表（前端「设置」页）> AI_LLM_* env（工作区根 .env，次级兜底为旧 AI_* 变量）> 内置默认。
 * 无 mock：未配置 key 时抛 AIConfigError（结构化配置引导），绝不返回假内容。
 */
import { getSupabase } from "../db";
import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { AIProvider, AIProviderName } from "./provider";
import { ClaudeAIProvider } from "./claude";
import { OpenAIProvider } from "./openai";

export type { AIProvider, AIProviderName } from "./provider";
export type { GenerateParams, GenerateResult, AnalyzeParams } from "./provider";

/** LLM 未配置时抛出；调用方（agent runtime / 编排器）据此展示配置引导而非假数据。 */
export class AIConfigError extends Error {
  constructor(message = "未配置 LLM API Key，请在 设置 中配置后重试") {
    super(message);
    this.name = "AIConfigError";
  }
}

interface AIConfig {
  provider: AIProviderName;
  model: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
}

const DEFAULT_CONFIG: AIConfig = {
  provider: "openai",
  model: "mimo-v2.5-pro",
  apiKey: "",
  baseUrl: "https://token-plan-cn.xiaomimimo.com",
  maxTokens: 4096,
  temperature: 0.7,
};

async function readConfig(): Promise<AIConfig> {
  const sb = getSupabase();
  const { data } = await sb.from("ai_config").select("key, value");
  const rows = (data ?? []) as Array<{ key: string; value: string }>;
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return {
    provider:
      (map.provider as AIProviderName) ??
      (process.env.AI_LLM_PROTOCOL as AIProviderName) ??
      (process.env.AI_PROVIDER as AIProviderName) ??
      DEFAULT_CONFIG.provider,
    model: map.model ?? process.env.AI_LLM_MODEL ?? process.env.AI_MODEL ?? DEFAULT_CONFIG.model,
    apiKey: map.api_key ?? process.env.AI_LLM_API_KEY ?? process.env.AI_API_KEY ?? DEFAULT_CONFIG.apiKey,
    baseUrl: map.base_url ?? process.env.AI_LLM_BASE_URL ?? process.env.AI_BASE_URL ?? DEFAULT_CONFIG.baseUrl,
    maxTokens: Number(map.max_tokens ?? process.env.AI_MAX_TOKENS ?? DEFAULT_CONFIG.maxTokens),
    temperature: Number(map.temperature ?? process.env.AI_TEMPERATURE ?? DEFAULT_CONFIG.temperature),
  };
}

function createProvider(config: AIConfig): AIProvider {
  if (!config.apiKey) {
    throw new AIConfigError();
  }
  switch (config.provider) {
    case "claude":
      return new ClaudeAIProvider({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl || undefined,
      });
    case "openai":
    default:
      return new OpenAIProvider({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl || undefined,
      });
  }
}

// Singleton — recreated on config change
let _provider: AIProvider | null = null;
let _configSnapshot: string | null = null;

/** Get the current AI provider. Reads config from DB each call; only recreates if changed. */
export async function getAIProvider(): Promise<AIProvider> {
  const config = await readConfig();
  const snapshot = JSON.stringify(config);

  if (!_provider || _configSnapshot !== snapshot) {
    _provider = createProvider(config);
    _configSnapshot = snapshot;
  }

  return _provider;
}

/** Force a fresh provider (used after config updates). */
export async function refreshAIProvider(): Promise<AIProvider> {
  _provider = null;
  _configSnapshot = null;
  _aiSdkModel = null;
  _aiSdkModelSnapshot = null;
  return await getAIProvider();
}

/** Read the current AI config for API responses. */
export async function getAIConfig(): Promise<AIConfig> {
  return await readConfig();
}

/** Update AI config. Accepts partial updates — only specified keys change. */
export async function updateAIConfig(updates: Partial<Record<string, string>>): Promise<AIConfig> {
  const sb = getSupabase();
  const now = new Date().toISOString();

  const entries = Object.entries(updates).filter(([, v]) => v !== undefined) as Array<[string, string]>;
  if (entries.length > 0) {
    await sb
      .from("ai_config")
      .upsert(
        entries.map(([key, value]) => ({ key, value, updated_at: now })),
        { onConflict: "key" }
      );
  }

  await refreshAIProvider();
  return await readConfig();
}

// ── AI SDK (Vercel AI SDK) model 工厂 ────────────────────────────
// 与上面的 getAIProvider 并行：传统链路用 AIProvider（手写 fetch），
// Web Agent 统一对话流（app/api/agent/chat）用 AI SDK 的 LanguageModel。

/** 网关 baseUrl 规范化：AI SDK 约定 baseURL 已含版本段（如 /v1），旧配置往往只有站点根。 */
function toSdkBaseURL(baseUrl: string): string | undefined {
  if (!baseUrl) return undefined;
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function createAISDKModel(config: AIConfig): LanguageModel {
  if (!config.apiKey) {
    throw new AIConfigError();
  }
  if (config.provider === "claude") {
    // LongCat 兼容层：其 Anthropic 网关在 message_start 里回 "usage":{}（缺
    // input_tokens），AI SDK 的 zod schema 要求 input_tokens 必为 number，
    // 解析失败会导致整条流报 "Expected a normalized Anthropic stream error"。
    // 此处在 SSE 文本层把空 usage 补上占位值（仅精确匹配 "usage":{}，不影响真实统计）。
    const sseUsageFixFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await fetch(input, init);
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("event-stream")) return res;
      const decoder = new TextDecoder();
      let buf = "";
      const fixed = res.body!.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            buf += decoder.decode(chunk, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            if (lines.length === 0) return; // 无完整行，继续缓冲（避免撕裂 SSE data 行）
            const out = lines
              .map((l) => l.replaceAll('"usage":{}', '"usage":{"input_tokens":0}'))
              .join("\n");
            controller.enqueue(new TextEncoder().encode(out + "\n"));
          },
          flush(controller) {
            if (buf) {
              controller.enqueue(
                new TextEncoder().encode(buf.replaceAll('"usage":{}', '"usage":{"input_tokens":0}')),
              );
            }
          },
        }),
      );
      return new Response(fixed, { status: res.status, statusText: res.statusText, headers: res.headers });
    }) as unknown as typeof fetch;
    const anthropic = createAnthropic({
      apiKey: config.apiKey,
      baseURL: toSdkBaseURL(config.baseUrl),
      // 双鉴权（LongCat 教训）：apiKey 生成 x-api-key，兼容网关还要求 Bearer；
      // 注意 apiKey 与 authToken 互斥（ai-sdk 会抛错），故用自定义 headers 追加 Authorization。
      headers: { Authorization: `Bearer ${config.apiKey}` },
      fetch: sseUsageFixFetch,
    });
    return anthropic(config.model);
  }
  // OpenAI 兼容端点：显式走 Chat Completions（.chat），
  // 直接调用 provider 会进 Responses API，mimo/LongCat 等网关不支持。
  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: toSdkBaseURL(config.baseUrl),
  });
  return openai.chat(config.model);
}

// Singleton — recreated on config change（参照 _provider 缓存写法）
let _aiSdkModel: LanguageModel | null = null;
let _aiSdkModelSnapshot: string | null = null;

/** Get the current AI SDK language model. Reads config from DB each call; only recreates if changed. */
export async function getAISDKModel(): Promise<LanguageModel> {
  const config = await readConfig();
  const snapshot = JSON.stringify(config);

  if (!_aiSdkModel || _aiSdkModelSnapshot !== snapshot) {
    _aiSdkModel = createAISDKModel(config);
    _aiSdkModelSnapshot = snapshot;
  }

  return _aiSdkModel;
}
