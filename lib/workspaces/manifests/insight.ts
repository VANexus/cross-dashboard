// lib/workspaces/manifests/insight.ts — 市场洞察空间
import { Satellite, BarChart3 } from "lucide-react";
import type { WorkspaceManifest } from "../types";

export const insightWorkspace: WorkspaceManifest = {
  id: "insight",
  label: "市场洞察",
  description: "平台情报与关键词趋势：选品与内容的第一手弹药库",
  icon: Satellite,
  group: "insight",
  order: 2,
  featured: true,
  entries: [
    { label: "情报中心", href: "/b2b/intel", icon: Satellite },
    { label: "关键词趋势", href: "/b2b/keyword-trends", icon: BarChart3 },
  ],
};
