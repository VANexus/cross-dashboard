// lib/workspaces/manifests/command.ts — 指挥台空间
import { LayoutDashboard } from "lucide-react";
import type { WorkspaceManifest } from "../types";

export const commandWorkspace: WorkspaceManifest = {
  id: "command-deck",
  label: "工作台",
  description: "运营总览：KPI 与工作流状态",
  icon: LayoutDashboard,
  group: "command",
  order: 1,
  featured: true,
  entries: [
    { label: "仪表盘", href: "/dashboard", icon: LayoutDashboard },
  ],
};
