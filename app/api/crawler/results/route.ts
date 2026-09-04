import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, methodNotAllowed } from "@/lib/server/api-response";
import { CrawlerService } from "@/lib/server/services/crawler.service";

const service = new CrawlerService();

export const GET = withDb(async (request: NextRequest) => {
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const results = await service.getRecentResults(limit);
  return success(results);
});

export { methodNotAllowed as POST };
