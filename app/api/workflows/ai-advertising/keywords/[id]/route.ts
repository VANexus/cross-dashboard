import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, notFound, methodNotAllowed } from "@/lib/api-response";
import { parseBody, updateAdKeywordSchema } from "@/lib/api-validation";
import { WorkflowService } from "@/lib/services";

const service = new WorkflowService();

export const PATCH = withDb(async (request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const parsed = parseBody(updateAdKeywordSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const kw = await service.updateAdKeyword(id, parsed.data);
  if (!kw) return notFound("Ad keyword");
  return success(kw);
});

export { methodNotAllowed as GET };
export { methodNotAllowed as POST };
export { methodNotAllowed as DELETE };