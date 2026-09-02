import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed, CONFIG_CACHE_HEADERS } from "@/lib/api-response";
import { ContentService } from "@/lib/services";

const service = new ContentService();

export const GET = withDb(async () => {
  return success(await service.getPlatforms(), undefined, 200, CONFIG_CACHE_HEADERS);
});

export { methodNotAllowed as POST };
