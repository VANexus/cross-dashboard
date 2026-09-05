import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, methodNotAllowed } from "@/lib/server/api-response";
import { B2BService } from "@/lib/server/services";

/**
 * B2B 铺货状态回查（P0-3）—— GET /api/b2b/listing/status-overview
 * 返回草稿状态计数 + 已上传草稿与在线货号对照 + 商品池规模。
 * - 默认秒回本地缓存；
 * - ?refresh=1 时触发阿里在线商品回查（TOP product.list，强一致对照线上货号）。
 */
const service = new B2BService();

export const GET = withDb(async (request: NextRequest) => {
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const [drafts, products, fresh] = await Promise.all([
    service.getListings().catch(() => []),
    service.getProducts().catch(() => []),
    refresh
      ? service.fetchProducts({ refresh: true }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const draftCounts: Record<string, number> = { draft: 0, uploading: 0, uploaded: 0, failed: 0 };
  for (const d of drafts as Array<{ uploadStatus?: string }>) {
    const s = d.uploadStatus ?? "draft";
    draftCounts[s] = (draftCounts[s] ?? 0) + 1;
  }

  const uploaded = (drafts as Array<{ title: string; uploadedProductId?: string; id: string }>)
    .filter((d) => d.uploadedProductId)
    .map((d) => ({ id: d.id, title: d.title, uploadedProductId: d.uploadedProductId }));

  return success({
    draftCounts,
    draftsTotal: drafts.length,
    productsCount: products.length,
    uploaded,
    // refresh=1 时的线上回查结果（失败/降级如实标注，不掩盖）
    online: fresh
      ? {
          products: fresh.products?.length ?? 0,
          authorized: fresh.authorized ?? false,
          degraded: fresh.degraded ?? (fresh.products?.length === 0),
          warning: fresh.warning ?? null,
          fetchedAt: fresh.fetchedAt ?? null,
        }
      : null,
    refreshed: refresh,
  });
});

export { methodNotAllowed as POST };