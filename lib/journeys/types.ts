// lib/journeys/types.ts
// 「业务旅程」manifest 类型——与 workspaces 同构的插件模式：
// 新增旅程 = manifests/<id>.ts + registry 登记一行。
import type { LucideIcon } from "lucide-react";

/** 旅程中的一个步骤（跨空间流转） */
export interface JourneyStep {
  id: string;
  label: string;
  description: string;
  /** 步骤落在哪个空间（lib/workspaces registry 的 workspace id） */
  workspaceId: string;
  /** 步骤页面（可带 query 上下文，如 ?journey=content-publish&step=2） */
  href: string;
  /** 给 Agent 的提示锚：执行到该步时建议调用的页面动作/关注点 */
  agentHint?: string;
  /** 步骤页面上可点的「下一步」把手选择器（driver.js tour 与 UI 高亮用） */
  handleSelector?: string;
}

export interface JourneyManifest {
  /** 稳定 id，如 "content-publish" */
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  steps: JourneyStep[];
  /** 编排中心排序，小在前 */
  order: number;
  /** false = 骨架旅程（编排中心仅展示，不可发起执行） */
  enabled: boolean;
  featured?: boolean;
}
