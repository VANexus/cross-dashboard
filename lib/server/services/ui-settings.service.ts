/**
 * UI 设置服务 —— 面向「界面行为偏好」的轻量 KV（复用 ai_config 表，与 B2B 设置同源）。
 *
 * 当前键：
 * - ui.pageEditorEnabled：AI 动态页面（/p/[slug]）是否展示「页面编辑器」（工具条/序号角标/就地编辑）。
 *   默认关闭 = 只读展示；开启后团队可像 no-code 编辑器那样微调组件。
 *   Agent 的上下文感知全量增量能力（generate/update_page）不受此开关影响，始终可对话驱动。
 */
import { prisma } from "../db";

const PAGE_EDITOR_KV = "ui.pageEditorEnabled";

export interface UISettings {
  /** 动态页面编辑器开关（默认 false = 纯只读展示） */
  pageEditorEnabled: boolean;
}

export class UISettingsService {
  async getSettings(): Promise<UISettings> {
    const row = await prisma.ai_config
      .findUnique({ where: { key: PAGE_EDITOR_KV }, select: { value: true } })
      .catch(() => null);
    return { pageEditorEnabled: row?.value === "1" };
  }

  async updateSettings(patch: Partial<UISettings>): Promise<UISettings> {
    const now = new Date().toISOString();
    if (typeof patch.pageEditorEnabled === "boolean") {
      await prisma.ai_config.upsert({
        where: { key: PAGE_EDITOR_KV },
        create: { key: PAGE_EDITOR_KV, value: patch.pageEditorEnabled ? "1" : "0", updated_at: now },
        update: { value: patch.pageEditorEnabled ? "1" : "0", updated_at: now },
      });
    }
    return this.getSettings();
  }
}