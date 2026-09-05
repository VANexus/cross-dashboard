// lib/workspaces/manifests/content.ts — 内容工坊空间
import { PenLine, Send, LayoutGrid } from "lucide-react";
import type { WorkspaceManifest } from "../types";

export const contentWorkspace: WorkspaceManifest = {
  id: "content-workshop",
  label: "内容工坊",
  description: "从趋势到成稿：思路 → 文案 → 审计 → 配图 → 发布一条龙",
  icon: PenLine,
  group: "content",
  order: 3,
  featured: true,
  entries: [
    { label: "内容创作中心", href: "/content-studio", icon: PenLine },
    { label: "公众号端到端发布", href: "/content-studio/wechat", icon: Send },
    { label: "成果库", href: "/creations", icon: LayoutGrid },
  ],
};
