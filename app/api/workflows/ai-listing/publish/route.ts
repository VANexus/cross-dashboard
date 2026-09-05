import type { NextRequest } from "next/server";
import { methodNotAllowed } from "@/lib/server/api-response";

/**
 * 旧 Amazon「AI 上架 → 发布」路由已废弃（2026-09-05）。
 * 商品发布链路已迁移到 B2B 域：B2BService.publishListing（TOP alibaba.icbu.product.add），
 * 入口 = 一键上架页 /b2b/listing + POST /api/b2b/listing/publish。
 */
export function POST(_request: NextRequest) {
  return Response.json(
    {
      success: false,
      error: "该发布接口已废弃：商品发布请走「一键上架」/b2b/listing（POST /api/b2b/listing/publish，阿里国际站 B2BService.publishListing）",
    },
    { status: 410 },
  );
}

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as DELETE };