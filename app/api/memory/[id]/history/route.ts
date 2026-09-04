import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, notFound, methodNotAllowed } from "@/lib/server/api-response";
import { MemoryService } from "@/lib/server/services";

const service = new MemoryService();

/**
 * GET /api/memory/:id/history
 * Mongo 中的记忆版本历史（不可变审计）。
 */
export const GET = withDb(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const entry = await service.getById(id);
  if (!entry) return notFound("Memory entry");
  const history = await service.getHistory(id);
  return success({ id, history });
});

export { methodNotAllowed as POST };
