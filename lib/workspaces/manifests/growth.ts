// lib/workspaces/manifests/growth.ts — 增长工作流空间
import {
  Sparkles, Radar, Image, BarChart3, Boxes, Target, Globe,
} from "lucide-react";
import type { WorkspaceManifest } from "../types";

export const growthWorkspace: WorkspaceManifest = {
  id: "growth",
  label: "增长工作流",
  description: "六大专项工作流：选品、作图、广告、库销、竞品、视频本地化",
  icon: Radar,
  group: "growth",
  order: 5,
  entries: [
    { label: "能力中心", href: "/skills", icon: Sparkles },
    { label: "选品工作流", href: "/workflows/product-research", icon: Radar, dot: "running" },
    { label: "AI 作图", href: "/workflows/ai-imaging", icon: Image, dot: "idle" },
    { label: "AI 广告", href: "/workflows/ai-advertising", icon: BarChart3, dot: "running" },
    { label: "库销比", href: "/workflows/inventory", icon: Boxes, dot: "warning" },
    { label: "竞品广告分析", href: "/workflows/competitor-ads", icon: Target, dot: "idle" },
    { label: "视频本地化", href: "/workflows/video-localization", icon: Globe },
  ],
};
