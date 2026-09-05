/**
 * FlowMind RAK — AI Provider Factory
 * Manages provider lifecycle and reads config from ai_config database table.
 * Supports frontend-configurable provider switching without env vars.
 * 配置优先级：ai_config 表（前端「设置」页）> AI_LLM_* env（工作区根 .env，次级兜底为旧 AI_* 变量）。
 * 无默认厂商/模型/网关：apiKey/baseUrl/model 一律由用户显式配置，缺配置抛 AIConfigError（结构化引导），绝不返回假内容。
 */
import { prisma } from "../db";
import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { AIProvider, AIProviderName } from "./provider";
import { SdkAIProvider } from "./sdk-provider";

export type { AIProvider, AIProviderName } from "./provider";
export type { GenerateParams, GenerateResult, AnalyzeParams } from "./provider";

/** LLM 未配置时抛出；调用方（agent runtime / 编排器）据此展示配置引导而非假数据。 */
export class AIConfigError extends Error {
  constructor(
    message =
      "模型未配置：请在 .env 填写你自己的 provider（AI_LLM_BASE_URL / AI_LLM_API_KEY / AI_LLM_MODEL / AI_LLM_PROTOCOL），或在设置页 ai_config 配置；代码不内置任何默认模型与网关",
  ) {
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

// 配置纪律（2026-09-05）：默认值只保「协议判定」与「数字参数」，不臆造厂商/模型/网关。
// - provider：openai = OpenAI 兼容协议判定（SiliconFlow / LiteLLM 等兼容网关都走它），非厂商承诺；
// - model / apiKey / baseUrl：一律留空 = 未配置 → 用户未填时抛 AIConfigError 引导配置，
//   绝不回落到代码内置的模型或集群默认网关（litellm 不作为兜底）。
const DEFAULT_CONFIG: AIConfig = {
  provider: "openai",
  model: "",
  apiKey: "",
  baseUrl: "",
  maxTokens: 4096,
  temperature: 0.7,
};

async function readConfig(): Promise<AIConfig> {
  let rows: Array<{ key: string; value: string }> = [];
  try {
    rows = await prisma.ai_config.findMany({ select: { key: true, value: true } });
  } catch {
    // 历史注释：旧 supabase 路径未检查 error（DB 不可读时按空配置回落 env/默认）——保持该容忍语义
  }
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  // 配置纪律（2026-09-05）：apiKey/baseUrl 只认「用户显式配置」＝ env 或 ai_config KV，
  // 不再回落集群 litellm 网关兜底（集群内由 Secret 注入 env，开发机由用户 .env 填写）。
  const envApiKey =
    process.env.LITELLM_MASTER_KEY?.trim() ||
    process.env.AI_LLM_API_KEY?.trim() ||
    process.env.AI_API_KEY?.trim();
  const envBaseUrl = process.env.AI_LLM_BASE_URL?.trim() || process.env.AI_BASE_URL?.trim();

// 模型归一化（纯 env 驱动，无内置名单）：AI_LLM_BLOCKED_MODELS=JSON 黑名单 + AI_LLM_MODEL_FALLBACK 回退目标；未配置则不干预。
function resolveModel(raw: string): string {
  const blockedRaw = process.env.AI_LLM_BLOCKED_MODELS?.trim();
  const fallback = process.env.AI_LLM_MODEL_FALLBACK?.trim();
  if (!blockedRaw || !fallback) return raw;
  try {
    const parsed = JSON.parse(blockedRaw) as unknown;
    if (!Array.isArray(parsed) || !parsed.map(String).includes(raw)) return raw;
  } catch {
    return raw;
  }
  return fallback;
}

const rawModel = map.model ?? process.env.AI_LLM_MODEL ?? process.env.AI_MODEL ?? DEFAULT_CONFIG.model;
const model = resolveModel(rawModel);

  return {
    provider:
      (map.provider as AIProviderName) ??
      (process.env.AI_LLM_PROTOCOL as AIProviderName) ??
      (process.env.AI_PROVIDER as AIProviderName) ??
      DEFAULT_CONFIG.provider,
    model,
    apiKey: envApiKey || map.api_key || DEFAULT_CONFIG.apiKey,
    baseUrl: envBaseUrl || map.base_url || DEFAULT_CONFIG.baseUrl,
    maxTokens: Number(map.max_tokens ?? process.env.AI_MAX_TOKENS ?? DEFAULT_CONFIG.maxTokens),
    temperature: Number(map.temperature ?? process.env.AI_TEMPERATURE ?? DEFAULT_CONFIG.temperature),
  };
}

function createProvider(config: AIConfig): AIProvider {
  if (!config.apiKey) {
    throw new AIConfigError();
  }
  if (!config.model) {
    throw new AIConfigError("模型未配置：请在 .env 填写 AI_LLM_MODEL（或在设置页 ai_config 配置 model）");
  }
  // 规范统一：全栈 LLM 只走 AI SDK 单一出口（SdkAIProvider），不再有手写 fetch 适配器。
  // modelFactory = getAISDKModel（同一个 LanguageModel 缓存），保证与对话流/内容生成同源。
  return new SdkAIProvider(() => getAISDKModel());
}

// Singleton — recreated on config change
let _provider: AIProvider | null = null;
let _configSnapshot: string | null = null;
let _cachedConfig: AIConfig | null = null;

/**
 * Get the current AI provider.
 * 配置只在首次读取或 refreshAIProvider()（updateAIConfig 会调用）后重读，
 * 避免 agent 每轮循环的 think+decide 各触发一次 ai_config 全表读
 * （6 个 agent 并发时会把 PG 连接池打满，单次读被拖到数秒）。
 */
export async function getAIProvider(): Promise<AIProvider> {
  let config: AIConfig;
  if (_cachedConfig) {
    config = _cachedConfig;
  } else {
    config = await readConfig();
    _cachedConfig = config;
  }
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
  _cachedConfig = null;
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
  const now = new Date().toISOString();

  const entries = Object.entries(updates).filter(([, v]) => v !== undefined) as Array<[string, string]>;
  if (entries.length > 0) {
    await Promise.all(entries.map(([key, value]) =>
      prisma.ai_config.upsert({
        where: { key },
        create: { key, value, updated_at: now },
        update: { value, updated_at: now },
      }),
    ));
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
  if (!config.model) {
    throw new AIConfigError("模型未配置：请在 .env 填写 AI_LLM_MODEL（或在设置页 ai_config 配置 model）");
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
  let config: AIConfig;
  if (_cachedConfig) {
    config = _cachedConfig;
  } else {
    config = await readConfig();
    _cachedConfig = config;
  }
  const snapshot = JSON.stringify(config);

  if (!_aiSdkModel || _aiSdkModelSnapshot !== snapshot) {
    _aiSdkModel = createAISDKModel(config);
    _aiSdkModelSnapshot = snapshot;
  }

  return _aiSdkModel;
}
