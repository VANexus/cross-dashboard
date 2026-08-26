import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed } from "@/lib/api-response";
import { ContentService } from "@/lib/services";

const service = new ContentService();

/** 成果库：文案草稿 ∪ 本地化视频。 */
export const GET = withDb(async () => {
  return success(service.getWorks());
});

export { methodNotAllowed as POST };
export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
