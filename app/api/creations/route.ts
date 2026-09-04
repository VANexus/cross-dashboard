import { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success } from "@/lib/server/api-response";
import { CreationsService } from "@/lib/server/services/creations.service";

/**
 * GET /api/creations — 统一成果库列表（聚合文案/创意/生图/Agent生成页）
 * query: type? （筛选类型）, q? （搜索）, limit?
 */
export const GET = withDb(async (request: NextRequest) => {
  const svc = new CreationsService();
  const sp = request.nextUrl.searchParams;
  const type = sp.get("type") ?? "";
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(500, Math.max(1, Number(sp.get("limit") ?? 100) || 100));

  let items = await svc.list(limit);
  if (type) items = items.filter((i) => i.type === type);
  if (q) {
    items = items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        (i.platform ?? "").toLowerCase().includes(q),
    );
  }
  const counts = await svc.counts();
  return success({ items, counts });
});