import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { getAIConfig, updateAIConfig } from "@/lib/ai";

export const GET = withDb(async (_request: NextRequest) => {
  const config = getAIConfig();
  return success({
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    demoMode: config.demoMode,
  });
});

export const POST = withDb(async (request: NextRequest) => {
  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const allowedKeys = ["provider", "model", "api_key", "base_url", "max_tokens", "temperature", "demo_mode"];
  const updates: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!allowedKeys.includes(key)) return badRequest(`Unknown config key: ${key}`);
    if (key === "provider" && !["mock", "claude", "openai"].includes(value)) return badRequest(`Invalid provider: ${value}`);
    if (key === "demo_mode" && !["true", "false"].includes(String(value))) return badRequest(`Invalid demo_mode: ${value}`);
    updates[key] = String(value);
  }
  if (Object.keys(updates).length === 0) return badRequest("No updates provided");
  const config = updateAIConfig(updates);
  return success({
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    demoMode: config.demoMode,
  });
});

export { methodNotAllowed as PUT };
export { methodNotAllowed as DELETE };