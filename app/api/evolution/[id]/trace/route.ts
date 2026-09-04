import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, notFound, methodNotAllowed } from "@/lib/server/api-response";
import { EvolutionService } from "@/lib/server/services";

const service = new EvolutionService();

/**
 * GET /api/evolution/:id/trace
 * Mongo 中该进化的五阶段审计轨迹。
 */
export const GET = withDb(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const record = await service.getById(id);
  if (!record) return notFound("Evolution record");
  const trace = await service.getRunTrace(id);
  return success(trace);
});

export { methodNotAllowed as POST };
