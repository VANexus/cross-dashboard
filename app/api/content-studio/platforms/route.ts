import { withDb } from "@/lib/server/api-helpers";
import { success, methodNotAllowed, CONFIG_CACHE_HEADERS } from "@/lib/server/api-response";
import { ContentService } from "@/lib/server/services";

const service = new ContentService();

export const GET = withDb(async () => {
  return success(await service.getPlatforms(), undefined, 200, CONFIG_CACHE_HEADERS);
});

export { methodNotAllowed as POST };
