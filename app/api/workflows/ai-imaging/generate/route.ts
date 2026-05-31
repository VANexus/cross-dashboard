import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, error, methodNotAllowed } from "@/lib/api-response";
import { parseBody, generateImageSchema } from "@/lib/api-validation";
import { WorkflowService } from "@/lib/services";

const service = new WorkflowService();

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(generateImageSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const result = await service.generateImage(parsed.data);
    return success(result);
  } catch (err) {
    return error(err instanceof Error ? err.message : "图片生成失败", 500);
  }
});

export { methodNotAllowed as GET };