import { withDb } from "@/lib/server/api-helpers";
import { success, methodNotAllowed } from "@/lib/server/api-response";
import { MemoryService } from "@/lib/server/services";

const service = new MemoryService();

/**
 * POST /api/memory/rebuild
 * 从 PG 全量重建 Milvus 语义索引。
 */
export const POST = withDb(async () => {
  const result = await service.rebuildIndex();
  return success(result);
});

export { methodNotAllowed as GET };
