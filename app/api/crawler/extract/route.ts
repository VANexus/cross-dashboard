import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, error, methodNotAllowed } from "@/lib/api-response";
import { CrawlerService } from "@/lib/services/crawler.service";

const service = new CrawlerService();

export const POST = withDb(async (request: NextRequest) => {
  try {
    const body = await request.json() as { storeId?: string; url?: string; type?: string };
    if (!body.storeId) return badRequest("storeId is required");

    let result;
    if (body.type === "orders") {
      result = await service.extractOrderData(body.storeId);
    } else if (body.url) {
      result = await service.extractProductData(body.storeId, body.url);
    } else {
      return badRequest("url is required for product extraction");
    }

    // Save to DB
    service.saveResult(result);
    return success(result);
  } catch (err) {
    return error(err instanceof Error ? err.message : "Extraction failed", 502);
  }
});

export { methodNotAllowed as GET };
