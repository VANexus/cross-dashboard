import { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success } from "@/lib/server/api-response";
import { ensurePresetTemplates, listTemplates } from "@/lib/server/agent-runtime/templates";

/** 预设 Agent 模板：GET 列表（首次访问自动同步 6 个预设人格）。 */
export const GET = withDb(async (_request: NextRequest) => {
  await ensurePresetTemplates();
  const data = await listTemplates();
  return success(data);
});
