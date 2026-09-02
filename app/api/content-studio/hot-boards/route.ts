import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, methodNotAllowed } from "@/lib/api-response";
import { ContentService } from "@/lib/services";

const service = new ContentService();

/** GET /api/content-studio/hot-boards?platform=xhs&categories=美妆,穿搭&boards=general,vertical */
export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const platform = (searchParams.get("platform") ?? "xhs") as "xhs" | "wechat" | "douyin";
  const categories = (searchParams.get("categories") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const boards = (searchParams.get("boards") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const result = await service.fetchHotBoards({ platform, categories, boards });
    return success(result);
  } catch (err) {
    return error(err instanceof Error ? err.message : "热榜引擎抓取失败", 500);
  }
});

export const POST = withDb(async (request: NextRequest) => {
  let platform: "xhs" | "wechat" | "douyin" = "xhs";
  let categories: string[] = [];
  let boards: string[] = [];
  try {
    const body = await request.json();
    platform = (body?.platform ?? "xhs") as "xhs" | "wechat" | "douyin";
    categories = Array.isArray(body?.categories) ? body.categories.map((s: unknown) => String(s).trim()).filter(Boolean) : [];
    boards = Array.isArray(body?.boards) ? body.boards.map((s: unknown) => String(s).trim()).filter(Boolean) : [];
  } catch { /* 非法 body 用默认值 */ }
  try {
    const result = await service.fetchHotBoards({ platform, categories, boards });
    return success(result);
  } catch (err) {
    return error(err instanceof Error ? err.message : "热榜引擎刷新失败", 500);
  }
});

export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
