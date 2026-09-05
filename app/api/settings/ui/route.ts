/**
 * UI 偏好设置 —— GET/POST /api/settings/ui
 * 目前仅一个键：pageEditorEnabled（AI 动态页面编辑器开关）。
 */
import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, methodNotAllowed } from "@/lib/server/api-response";
import { UISettingsService } from "@/lib/server/services/ui-settings.service";

const svc = new UISettingsService();

export const GET = withDb(async () => {
  try {
    return success(await svc.getSettings());
  } catch (e) {
    return error(e instanceof Error ? e.message : "读取 UI 设置失败", 500);
  }
});

export const POST = withDb(async (request: NextRequest) => {
  let body: { pageEditorEnabled?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return error("body 必须是 JSON", 400);
  }
  const patch: Partial<{ pageEditorEnabled: boolean }> = {};
  if (typeof body.pageEditorEnabled === "boolean") patch.pageEditorEnabled = body.pageEditorEnabled;
  if (Object.keys(patch).length === 0) return error("没有可更新的设置项", 400);
  try {
    return success(await svc.updateSettings(patch));
  } catch (e) {
    return error(e instanceof Error ? e.message : "保存 UI 设置失败", 500);
  }
});

export { methodNotAllowed as PUT, methodNotAllowed as DELETE };