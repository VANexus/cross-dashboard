import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { runListingPipeline } from "@/lib/server/mastra/tools/selfhost-tools";

/**
 * 批量铺货流水线（HTTP 版，草稿态不对发布）—— POST /api/b2b/listing/pipeline
 * 与 Agent 的 launch_listing_pipeline 工具共用同一执行体：
 * 趋势词（缺省最近 TikTok 热榜）→ 商品池 RAG → AI 推荐 → 批量 Listing 草稿 + 主图落库。
 */
export const POST = withDb(async (request: NextRequest) => {
  let body: { trendKeywords?: string[]; preference?: string; limit?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* 无 body 走默认 */
  }
  const preference = body.preference === "social" || body.preference === "mix" ? body.preference : "alibaba";
  const limit = typeof body.limit === "number" ? Math.max(1, Math.min(6, Math.round(body.limit))) : undefined;
  const trendKeywords = Array.isArray(body.trendKeywords)
    ? body.trendKeywords.map((s) => String(s).trim()).filter(Boolean).slice(0, 8)
    : undefined;
  if (limit && Number.isNaN(limit)) return badRequest("limit 不合法");

  const result = await runListingPipeline({ trendKeywords, preference, limit });
  return success(result);
});

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as DELETE };