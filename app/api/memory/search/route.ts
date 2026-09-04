import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest } from "@/lib/server/api-response";
import { MemoryService } from "@/lib/server/services";

const service = new MemoryService();

/**
 * GET /api/memory/search?q=...&limit=...&agentId=...
 * Milvus 混合语义检索（dense + BM25 → RRF）。
 */
export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return badRequest("缺少搜索词 q");
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 10) || 10, 1), 50);
  const agentId = searchParams.get("agentId")?.trim() || undefined;
  const results = await service.search(q, { limit, agentId });
  return success(results);
});
