import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, notFound, methodNotAllowed } from "@/lib/api-response";
import { MemoryService } from "@/lib/services";

const service = new MemoryService();

export const GET = withDb(async (_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const usage = service.getUsage(id);
  if (!usage) return notFound("Memory entry");
  return success(usage);
});

export { methodNotAllowed as POST };