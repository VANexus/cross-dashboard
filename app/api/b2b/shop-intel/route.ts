import type { NextRequest } from "next/server";
import { success, error, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, shopIntelSchema } from "@/lib/server/api-validation";
import { IntelService } from "@/lib/server/services";
import { ContentMCPError } from "@/lib/mcp/client";

const service = new IntelService();

export const POST = async (request: NextRequest) => {
  const parsed = parseBody(shopIntelSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const q = parsed.data;
  try {
    let result: Awaited<ReturnType<IntelService["searchProducts"]>>;
    switch (q.action) {
      case "search":
        if (!q.keyword?.trim()) return badRequest("search 需要关键词 keyword");
        result = await service.searchProducts({ keyword: q.keyword, region: q.region, limit: q.limit, offset: q.offset });
        break;
      case "suggest":
        if (!q.keyword?.trim()) return badRequest("suggest 需要关键词 keyword");
        result = await service.searchSuggest({ keyword: q.keyword, region: q.region });
        break;
      case "categories":
        result = await service.shopCategories(q.region ?? "US");
        break;
      case "detail":
        if (!q.productId?.trim()) return badRequest("detail 需要 productId");
        result = await service.productDetail({ productId: q.productId, region: q.region });
        break;
      case "reviews":
        if (!q.productId?.trim()) return badRequest("reviews 需要 productId");
        result = await service.productReviews({ productId: q.productId, region: q.region, page: q.page, limit: q.limit });
        break;
      case "seller":
        if (!q.sellerId?.trim()) return badRequest("seller 需要 sellerId");
        result = await service.sellerProducts({ sellerId: q.sellerId, region: q.region, limit: q.limit });
        break;
      default:
        return badRequest("不支持的 action");
    }
    return success(result);
  } catch (err) {
    if (err instanceof ContentMCPError) return error(err.message, err.category === "skill" ? 422 : 503);
    return error(err instanceof Error ? err.message : "选品情报查询失败", 500);
  }
};

export { methodNotAllowed as GET };
export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
