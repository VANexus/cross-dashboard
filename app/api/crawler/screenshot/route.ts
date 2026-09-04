import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, error, methodNotAllowed } from "@/lib/server/api-response";
import { CrawlerService } from "@/lib/server/services/crawler.service";

const service = new CrawlerService();

export const POST = withDb(async (request: NextRequest) => {
  try {
    const body = await request.json() as { storeId?: string; fullPage?: boolean };
    if (!body.storeId) return badRequest("storeId is required");
    const screenshot = await service.screenshot(body.storeId, body.fullPage ?? false);
    return success({ screenshot });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Screenshot failed", 502);
  }
});

export { methodNotAllowed as GET };
