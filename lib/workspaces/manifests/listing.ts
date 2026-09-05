// lib/workspaces/manifests/listing.ts — 上架运营空间
import { PackagePlus, Image } from "lucide-react";
import type { WorkspaceManifest } from "../types";

export const listingWorkspace: WorkspaceManifest = {
  id: "listing-ops",
  label: "上架运营",
  description: "Listing 生成 → 生图素材 → 跨平台上架流水线",
  icon: PackagePlus,
  group: "listing",
  order: 4,
  featured: true,
  entries: [
    { label: "一键上架", href: "/b2b/listing", icon: PackagePlus },
    { label: "生图 Skill 库", href: "/b2b/image-skills", icon: Image },
    // 工作流目录已统一收纳 /workflows/*，此处隐藏避免双入口（命令面板仍可达）
    { label: "AI 上架工作流", href: "/workflows/ai-listing", icon: PackagePlus, dot: "running", hidden: true },
  ],
};
