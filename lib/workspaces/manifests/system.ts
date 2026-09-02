// lib/workspaces/manifests/system.ts — 系统空间
import { Brain, Sparkles, Settings, Bug } from "lucide-react";
import type { WorkspaceManifest } from "../types";

export const systemWorkspace: WorkspaceManifest = {
  id: "system",
  label: "系统",
  description: "记忆、自进化与平台设置",
  icon: Brain,
  group: "system",
  order: 7,
  entries: [
    { label: "记忆系统", href: "/memory", icon: Brain },
    { label: "自进化", href: "/evolution", icon: Sparkles },
    { label: "设置", href: "/settings", icon: Settings },
    { label: "爬虫诊断", href: "/crawler", icon: Bug, hidden: true },
  ],
};
