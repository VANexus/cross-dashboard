import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, notFound, methodNotAllowed } from "@/lib/server/api-response";
import { MemoryService } from "@/lib/server/services";

const service = new MemoryService();

export const GET = withDb(async (_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const usage = await service.getUsage(id);
  if (!usage) return notFound("Memory entry");
  return success(usage);
});

export { methodNotAllowed as POST };