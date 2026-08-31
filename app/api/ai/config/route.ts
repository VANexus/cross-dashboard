import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { getAIConfig, updateAIConfig } from "@/lib/ai";

export const GET = withDb(async (_request: NextRequest) => {
  const config = await getAIConfig();
  return success({
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });
});

export const POST = withDb(async (request: NextRequest) => {
  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const allowedKeys = ["provider", "model", "api_key", "base_url", "max_tokens", "temperature"];
  const updates: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!allowedKeys.includes(key)) return badRequest(`Unknown config key: ${key}`);
    if (key === "provider" && !["claude", "openai"].includes(value)) return badRequest(`Invalid provider: ${value}`);
    updates[key] = String(value);
  }
  if (Object.keys(updates).length === 0) return badRequest("No updates provided");
  const config = await updateAIConfig(updates);
  return success({
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });
});

export { methodNotAllowed as PUT };
export { methodNotAllowed as DELETE };