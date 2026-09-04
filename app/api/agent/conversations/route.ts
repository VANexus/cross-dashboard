import { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, methodNotAllowed } from "@/lib/server/api-response";
import { ConversationService } from "@/lib/server/services/conversation.service";

const svc = new ConversationService();

/** GET /api/agent/conversations — 会话列表（更新时间倒序） */
export const GET = withDb(async () => {
  try {
    const items = await svc.list(50);
    return success(items);
  } catch (e) {
    return error(e instanceof Error ? e.message : "会话列表读取失败", 500);
  }
});

/** POST /api/agent/conversations — 新建会话 */
export const POST = withDb(async (request: NextRequest) => {
  let title = "新对话";
  try {
    const body = (await request.json()) as { title?: string };
    title = body.title?.trim() || "新对话";
  } catch {
    /* 无 body 也允许 */
  }
  try {
    const conv = await svc.create(title);
    return success(conv, undefined, 201);
  } catch (e) {
    return error(e instanceof Error ? e.message : "会话创建失败", 500);
  }
});

export { methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE };
