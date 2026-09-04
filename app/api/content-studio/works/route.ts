import { withDb } from "@/lib/server/api-helpers";
import { success, methodNotAllowed } from "@/lib/server/api-response";
import { ContentService } from "@/lib/server/services";

const service = new ContentService();

/** 成果库：文案草稿 ∪ 本地化视频。 */
export const GET = withDb(async () => {
  return success(await service.getWorks());
});

export { methodNotAllowed as POST };
export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
