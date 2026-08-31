import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { B2BSettingsService } from "@/lib/services";
import type { B2BSettings } from "@/lib/types";

const service = new B2BSettingsService();

const ALLOWED_KEYS: Array<keyof B2BSettings> = [
  "flowmindMcpUrl",
  "tiktokSessionCookie",
  "instagramSessionCookie",
  "alibabaAppKey",
  "alibabaAppSecret",
  "alibabaSession",
  "longcatApiKey",
  "allinApiKey",
  "feishuWebhookUrl",
  "wecomWebhookUrl",
  "b2bPushFeishuEnabled",
  "b2bPushWecomEnabled",
  "b2bDailyRefreshUrl",
  "b2bDailyRefreshToken",
];

export const GET = withDb(async () => success(await service.getSettings()));

export const POST = withDb(async (request: NextRequest) => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body");
  }
  const patch: Partial<B2BSettings> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS.includes(key as keyof B2BSettings)) {
      return badRequest(`Unknown config key: ${key}`);
    }
    (patch as Record<string, unknown>)[key] = value === undefined || value === null ? "" : String(value);
  }
  if (Object.keys(patch).length === 0) return badRequest("No updates provided");
  return success(await service.updateSettings(patch));
});

export { methodNotAllowed as PUT };
export { methodNotAllowed as DELETE };
