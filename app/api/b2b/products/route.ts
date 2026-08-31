import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, badRequest, methodNotAllowed } from "@/lib/api-response";
import { parseBody, b2bProductsSchema } from "@/lib/api-validation";
import { B2BService, ContentMCPError } from "@/lib/services";

const service = new B2BService();

export const GET = withDb(async () => {
  const result = await service.fetchProducts({ refresh: false });
  return success(result);
});

export const POST = withDb(async (request: NextRequest) => {
  const parsed = parseBody(b2bProductsSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const result = await service.fetchProducts({ refresh: true });
    return success(result);
  } catch (err) {
    if (err instanceof ContentMCPError) return error(err.message, err.category === "skill" ? 422 : 503);
    return error(err instanceof Error ? err.message : "商品拉取失败", 500);
  }
});

export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };