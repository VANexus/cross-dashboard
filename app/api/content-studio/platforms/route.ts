import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed } from "@/lib/api-response";
import { ContentService } from "@/lib/services";

const service = new ContentService();

export const GET = withDb(async () => {
  return success(await service.getPlatforms());
});

export { methodNotAllowed as POST };
