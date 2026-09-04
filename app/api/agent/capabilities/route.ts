import { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success } from "@/lib/server/api-response";
import { listCapabilities } from "@/lib/server/agent/capabilities";

/** Agent 能力目录：真实能力清单（业务 + 编排 + 记忆 + Agent 组建），供「能力中心」展示与一键编排。 */
export const GET = withDb(async (_request: NextRequest) => {
  return success(listCapabilities());
});
