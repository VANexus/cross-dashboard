// lib/workspaces/registry.ts
// 「插件市场」聚合点：新增空间 = lib/workspaces/manifests/ 下加一个文件 + 在下方数组登记一行。
// 侧边栏、编排中心、命令面板全部从本注册表派生——框架代码零改动。
import type { LucideIcon } from "lucide-react";
import type { WorkspaceGroup, WorkspaceManifest } from "./types";
import { commandWorkspace } from "./manifests/command";
import { insightWorkspace } from "./manifests/insight";
import { contentWorkspace } from "./manifests/content";
import { listingWorkspace } from "./manifests/listing";
import { growthWorkspace } from "./manifests/growth";
import { monitorWorkspace } from "./manifests/monitor";
import { systemWorkspace } from "./manifests/system";

/** 全部工作流空间（插件在此登记） */
export const workspaces: WorkspaceManifest[] = [
  commandWorkspace,
  insightWorkspace,
  contentWorkspace,
  listingWorkspace,
  growthWorkspace,
  monitorWorkspace,
  systemWorkspace,
];

/** 分组显示名与顺序 */
export const groupMeta: { key: WorkspaceGroup; label: string }[] = [
  { key: "command", label: "概览指挥" },
  { key: "insight", label: "市场洞察" },
  { key: "content", label: "内容工坊" },
  { key: "listing", label: "上架运营" },
  { key: "growth", label: "增长工作流" },
  { key: "monitor", label: "运行监控" },
  { key: "system", label: "系统" },
];

/** 按 group 排序后的注册表 */
export const sortedWorkspaces = [...workspaces].sort((a, b) => {
  const gi = groupMeta.findIndex((g) => g.key === a.group) - groupMeta.findIndex((g) => g.key === b.group);
  return gi !== 0 ? gi : a.order - b.order;
});

export function getWorkspaceById(id: string): WorkspaceManifest | undefined {
  return workspaces.find((w) => w.id === id);
}

/** 当前路径所属空间（子页/详情页归属其 workspace 前缀） */
export function getWorkspaceByPath(pathname: string | null): WorkspaceManifest | undefined {
  if (!pathname) return undefined;
  return sortedWorkspaces.find((w) =>
    w.entries.some((e) => pathname === e.href || pathname.startsWith(e.href + "/")),
  );
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  dot?: string;
}

export interface NavGroup {
  workspaceId: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

/** 侧边栏导航 = 分组（groupMeta 顺序）× 空间（非 hidden entries） */
export function getNavGroups(): NavGroup[] {
  return groupMeta
    .map(({ key, label }) => ({
      key,
      label,
      ws: sortedWorkspaces.filter((w) => w.group === key),
    }))
    .flatMap(({ label, ws }) =>
      ws.map((w) => ({
        workspaceId: w.id,
        label: ws.length > 1 ? `${label} · ${w.label}` : label,
        icon: w.icon,
        items: w.entries
          .filter((e) => !e.hidden)
          .map((e) => ({ label: e.label, href: e.href, icon: e.icon, dot: e.dot })),
      })),
    );
}

/** 命令面板/编排中心用：全部可导航入口（含 hidden） */
export function getAllEntries(): { label: string; href: string; icon: LucideIcon; workspaceLabel: string }[] {
  return sortedWorkspaces.flatMap((w) =>
    w.entries.map((e) => ({ label: e.label, href: e.href, icon: e.icon, workspaceLabel: w.label })),
  );
}
