import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, b2bProductsSchema } from "@/lib/server/api-validation";
import { B2BService, ContentMCPError } from "@/lib/server/services";
import { getProducts, getProductsFetchedAt } from "@/lib/server/repositories/b2b.repository";
import { shouldBackgroundRefresh } from "@/lib/utils/refresh-gate";

const service = new B2BService();

/** 商品池数据视为新鲜的时间窗 */
const FRESH_MS = 30 * 60_000;

export const GET = withDb(async () => {
  // DB 秒回：有缓存直接返回，过期则后台保鲜（防抖 10 分钟一次）
  const [cached, fetchedAt] = await Promise.all([
    getProducts(),
    getProductsFetchedAt().catch(() => null),
  ]);

  if (cached.length > 0) {
    const ageMs = fetchedAt ? Date.now() - new Date(fetchedAt).getTime() : Number.POSITIVE_INFINITY;
    const refreshing = ageMs >= FRESH_MS && shouldBackgroundRefresh("b2b-products");
    if (refreshing) {
      service.fetchProducts({ refresh: true }).catch(
        (e) => console.error("[products 后台保鲜]", e instanceof Error ? e.message : e),
      );
    }
    return success({
      products: cached,
      authorized: true,
      fetchedAt: fetchedAt ?? undefined,
      refreshing,
    });
  }

  // 冷启动：无任何 DB 数据，同步拉取
  try {
    const result = await service.fetchProducts({ refresh: true });
    return success(result);
  } catch (err) {
    if (err instanceof ContentMCPError) return error(err.message, err.category === "skill" ? 422 : 503);
    return error(err instanceof Error ? err.message : "商品拉取失败", 500);
  }
});

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(b2bProductsSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const result = await service.fetchProducts({ refresh: true });
    return success(result);
  } catch (err) {
    if (err instanceof ContentMCPError) return error(err.message, err.category === "skill" ? 422 : 503);
    return error(err instanceof Error ? err.message : "商品拉取失败", 500);
  }
});

export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };