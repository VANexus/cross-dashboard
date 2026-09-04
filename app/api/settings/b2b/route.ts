import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, methodNotAllowed, CONFIG_CACHE_HEADERS } from "@/lib/server/api-response";
import { B2BSettingsService } from "@/lib/server/services";
import type { B2BSettings } from "@/lib/shared/types";

const service = new B2BSettingsService();

/**
 * 服务化（2026-09-03）：白名单只含业务凭证。
 * 曾接受的 flowmindMcpUrl / longcatApiKey / allinApiKey 已退役——
 * 端点走集群服务目录、凭据走 Secret，提交这些键返回 400 引导。
 */
const ALLOWED_KEYS: Array<keyof B2BSettings> = [
  "tiktokSessionCookie",
  "instagramSessionCookie",
  "alibabaAppKey",
  "alibabaAppSecret",
  "alibabaSession",
  "feishuWebhookUrl",
  "wecomWebhookUrl",
  "b2bPushFeishuEnabled",
  "b2bPushWecomEnabled",
  "b2bDailyRefreshUrl",
  "b2bDailyRefreshToken",
];

export const GET = withDb(async () => success(await service.getSettings(), undefined, 200, CONFIG_CACHE_HEADERS));

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
