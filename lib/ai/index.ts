/**
 * FlowMind RAK — AI Provider Factory
 * Manages provider lifecycle and reads config from ai_config database table.
 * Supports frontend-configurable provider switching without env vars.
 * 无 mock：未配置 key 时抛 AIConfigError（结构化配置引导），绝不返回假内容。
 */
import { getSupabase } from "../db";
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
    provider: (map.provider as AIProviderName) ?? (process.env.AI_PROVIDER as AIProviderName) ?? DEFAULT_CONFIG.provider,
    model: map.model ?? process.env.AI_MODEL ?? DEFAULT_CONFIG.model,
    apiKey: map.api_key ?? process.env.AI_API_KEY ?? DEFAULT_CONFIG.apiKey,
    baseUrl: map.base_url ?? process.env.AI_BASE_URL ?? DEFAULT_CONFIG.baseUrl,
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
