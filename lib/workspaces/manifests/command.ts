// lib/workspaces/manifests/command.ts — 指挥台空间
import { LayoutDashboard } from "lucide-react";
import type { WorkspaceManifest } from "../types";

export const commandWorkspace: WorkspaceManifest = {
  id: "command-deck",
  label: "指挥台",
  description: "全局运营总览：KPI、工作流健康、AI 实时动态",
  icon: LayoutDashboard,
  group: "command",
  order: 1,
  featured: true,
  entries: [
    { label: "仪表盘", href: "/dashboard", icon: LayoutDashboard },
  ],
};
