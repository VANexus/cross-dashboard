// lib/workspaces/types.ts
// 「工作流空间」插件化 manifest 类型——新增空间 = 新增一个 manifests/*.ts 文件并在 registry 登记一行
import type { LucideIcon } from "lucide-react";

/** 空间分组（决定侧边栏顺序与编排中心分区） */
export type WorkspaceGroup =
  | "command"
  | "insight"
  | "content"
  | "listing"
  | "growth"
  | "monitor"
  | "system";

/** 空间/子页状态点（与 StatusDot 对应） */
export type WorkspaceDot = "running" | "idle" | "warning" | "error";

/** 空间内子页入口 */
export interface WorkspaceEntry {
  label: string;
  href: string;
  icon: LucideIcon;
  dot?: WorkspaceDot;
  /** true = 收进系统不显眼入口（不进侧边栏主列表） */
  hidden?: boolean;
}

/**
 * 工作流空间 manifest——插件市场式注册的最小协议。
 * 新空间三步：建 manifests/<id>.ts → registry.ts 数组加一行 → 完成（侧边栏/编排中心/命令面板自动出现）。
 */
export interface WorkspaceManifest {
  /** 稳定 id，如 "content-workshop" */
  id: string;
  label: string;
  /** 编排中心卡片描述 */
  description: string;
  icon: LucideIcon;
  group: WorkspaceGroup;
  /** 组内排序，小在前 */
  order: number;
  entries: WorkspaceEntry[];
  /** 编排中心是否重点展示 */
  featured?: boolean;
}
