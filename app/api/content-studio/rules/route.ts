import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed } from "@/lib/api-response";
import { ContentService } from "@/lib/services";

const service = new ContentService();

/** GET /api/content-studio/rules?platform=xhs —— 规则库（展示用） */
export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") ?? undefined;
  return success(service.getRules(platform as never));
});

export { methodNotAllowed as POST };
export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
