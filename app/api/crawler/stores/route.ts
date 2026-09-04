import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, methodNotAllowed } from "@/lib/server/api-response";
import { CrawlerService } from "@/lib/server/services/crawler.service";

const service = new CrawlerService();

export const GET = withDb(async (_: NextRequest) => {
  try {
    const status = await service.getStatus();
    return success(status);
  } catch (err) {
    return error(err instanceof Error ? err.message : "Failed to connect to Ziniao bridge", 502);
  }
});

export { methodNotAllowed as POST };
