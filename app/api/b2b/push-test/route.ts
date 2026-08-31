import type { NextRequest } from "next/server";
import { z } from "zod";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody } from "@/lib/api-validation";
import { B2BService, ContentMCPError } from "@/lib/services";
import type { PushTestResult } from "@/lib/types";

const service = new B2BService();

const pushTestSchema = z.object({
  channel: z.enum(["feishu", "wecom"]),
});

/** POST /api/b2b/push-test — 发送测试卡片到飞书/企微（走真实 MCP push skill）。 */
export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(pushTestSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const result: PushTestResult = await service.testPush({ channel: parsed.data.channel });
    return success(result);
  } catch (err) {
    if (err instanceof ContentMCPError) {
      return success<PushTestResult>({ channel: parsed.data.channel, ok: false, latencyMs: 0, error: err.message });
    }
    return success<PushTestResult>({
      channel: parsed.data.channel,
      ok: false,
      latencyMs: 0,
      error: err instanceof Error ? err.message : "推送测试失败",
    });
  }
});

export { methodNotAllowed as GET };
export { methodNotAllowed as PUT };
export { methodNotAllowed as DELETE };
