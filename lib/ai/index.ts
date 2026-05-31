/**
 * FlowMind RAK — AI Provider Factory
 * Manages provider lifecycle and reads config from ai_config database table.
 * Supports frontend-configurable provider switching without env vars.
 */
import { getDb } from "../db";
import type { AIProvider, AIProviderName } from "./provider";
import { MockAIProvider } from "./mock";
import { ClaudeAIProvider } from "./claude";
import { OpenAIProvider } from "./openai";

export type { AIProvider, AIProviderName } from "./provider";
export type { GenerateParams, GenerateResult, AnalyzeParams, ImageParams, ImageResult } from "./provider";

interface AIConfig {
  provider: AIProviderName;
  model: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
  demoMode: boolean;
}

const DEFAULT_CONFIG: AIConfig = {
  provider: "mock",
  model: "mimo-v2.5-pro",
  apiKey: "",
  baseUrl: "https://token-plan-cn.xiaomimimo.com",
  maxTokens: 4096,
  temperature: 0.7,
  demoMode: false,
};

function readConfig(): AIConfig {
  const db = getDb();
  const rows = db.query("SELECT key, value FROM ai_config").all() as { key: string; value: string }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return {
    provider: (map.provider as AIProviderName) ?? (process.env.AI_PROVIDER as AIProviderName) ?? DEFAULT_CONFIG.provider,
    model: map.model ?? process.env.AI_MODEL ?? DEFAULT_CONFIG.model,
    apiKey: map.api_key ?? process.env.AI_API_KEY ?? DEFAULT_CONFIG.apiKey,
    baseUrl: map.base_url ?? process.env.AI_BASE_URL ?? DEFAULT_CONFIG.baseUrl,
    maxTokens: Number(map.max_tokens ?? process.env.AI_MAX_TOKENS ?? DEFAULT_CONFIG.maxTokens),
    temperature: Number(map.temperature ?? process.env.AI_TEMPERATURE ?? DEFAULT_CONFIG.temperature),
    demoMode: map.demo_mode !== undefined ? map.demo_mode !== "false" : (process.env.AI_DEMO_MODE !== "false"),
  };
}

function createProvider(config: AIConfig): AIProvider {
  switch (config.provider) {
    case "claude":
      return new ClaudeAIProvider({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl || undefined,
      });
    case "openai":
      return new OpenAIProvider({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl || undefined,
      });
    case "mock":
    default:
      return new MockAIProvider();
  }
}

// Singleton — recreated on config change
let _provider: AIProvider | null = null;
let _configSnapshot: string | null = null;

/** Get the current AI provider. Reads config from DB each call; only recreates if changed. */
export function getAIProvider(): AIProvider {
  const config = readConfig();
  const snapshot = JSON.stringify(config);

  if (!_provider || _configSnapshot !== snapshot) {
    _provider = createProvider(config);
    _configSnapshot = snapshot;
  }

  return _provider;
}

/** Force a fresh provider (used after config updates). */
export function refreshAIProvider(): AIProvider {
  _provider = null;
  _configSnapshot = null;
  return getAIProvider();
}

/** Read the current AI config for API responses. */
export function getAIConfig(): AIConfig {
  return readConfig();
}

/** Check if demo mode is active. */
export function isDemoMode(): boolean {
  return readConfig().demoMode;
}

/** Update AI config. Accepts partial updates — only specified keys change. */
export function updateAIConfig(updates: Partial<Record<string, string>>): AIConfig {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO ai_config (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  );

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      stmt.run(key, value);
    }
  }

  refreshAIProvider();
  return readConfig();
}
