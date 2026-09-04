import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, notFound, methodNotAllowed } from "@/lib/server/api-response";
import { parseBody, updateImageSchema } from "@/lib/server/api-validation";
import { WorkflowService } from "@/lib/server/services";

const service = new WorkflowService();

export const PATCH = withDb(async (request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const parsed = parseBody(updateImageSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const img = await service.updateImage(id, parsed.data);
  if (!img) return notFound("Image");
  return success(img);
});

export { methodNotAllowed as GET };
export { methodNotAllowed as POST };
export { methodNotAllowed as DELETE };