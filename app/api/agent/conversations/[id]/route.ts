import { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, notFound, methodNotAllowed } from "@/lib/server/api-response";
import { ConversationService } from "@/lib/server/services/conversation.service";

const svc = new ConversationService();

/** GET /api/agent/conversations/[id] — 会话详情（含消息，时间正序） */
export const GET = withDb(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  try {
    const conv = await svc.get(id);
    if (!conv) return notFound("Conversation");
    return success(conv);
  } catch (e) {
    return error(e instanceof Error ? e.message : "会话读取失败", 500);
  }
});

/** DELETE /api/agent/conversations/[id] — 删除会话 */
export const DELETE = withDb(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  try {
    const ok = await svc.delete(id);
    if (!ok) return notFound("Conversation");
    return success({ ok: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "会话删除失败", 500);
  }
});

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH };
