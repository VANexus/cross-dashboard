import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, methodNotAllowed } from "@/lib/server/api-response";
import { B2BService } from "@/lib/server/services";
import type { TrendPlatform } from "@/lib/shared/types";

const service = new B2BService();

export const GET = withDb(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const platform = (searchParams.get("platform") ?? "tiktok") as TrendPlatform;
  const days = Math.min(90, Math.max(2, Number(searchParams.get("days") ?? 14)));
  try {
    const result = await service.getTrendRising(platform, Number.isFinite(days) ? days : 14);
    return success(result);
  } catch (err) {
    return error(err instanceof Error ? err.message : "趋势快照查询失败", 500);
  }
});

export { methodNotAllowed as POST };
export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
