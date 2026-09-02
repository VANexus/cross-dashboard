// lib/workspaces/manifests/monitor.ts — 运行监控空间
import { ShieldCheck, Bot, ListTodo } from "lucide-react";
import type { WorkspaceManifest } from "../types";

export const monitorWorkspace: WorkspaceManifest = {
  id: "monitor",
  label: "运行监控",
  description: "账号风险、Agent 运行、任务队列的健康面板",
  icon: ShieldCheck,
  group: "monitor",
  order: 6,
  entries: [
    { label: "账号风险", href: "/risk", icon: ShieldCheck },
    { label: "Agent 管理", href: "/agents", icon: Bot },
    { label: "任务中心", href: "/tasks", icon: ListTodo },
  ],
};
