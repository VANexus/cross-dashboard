/**
 * 动态页面清单（M5）—— GET /api/agent/pages
 *
 * 侧边栏导航注入用：列出 agent 生成的 /p/[slug] 页面（id/title/updated_at）。
 * 读多写少的配置类端点 → CONFIG_CACHE_HEADERS（60s 强缓存 + 5min SWR）。
 */
import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, methodNotAllowed, CONFIG_CACHE_HEADERS } from "@/lib/api-response";
import { getKernel } from "@/src/kernel";

export const GET = withDb(async (_: NextRequest) => {
  const kernel = await getKernel();
  try {
    const data = await kernel.specs.listPageSpecs(100);
    return success(data, undefined, 200, CONFIG_CACHE_HEADERS);
  } catch (err) {
    // spec 表未建（迁移未执行）等场景：导航注入是增量能力，降级为空清单
    console.error("[agent/pages]", err);
    return success([], undefined, 200, CONFIG_CACHE_HEADERS);
  }
});

export { methodNotAllowed as POST };
