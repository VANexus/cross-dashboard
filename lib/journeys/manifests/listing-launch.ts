// lib/journeys/manifests/listing-launch.ts — J2 选品上架旅程
import { PackagePlus } from "lucide-react";
import type { JourneyManifest } from "../types";

export const listingLaunchJourney: JourneyManifest = {
  id: "listing-launch",
  label: "选品上架旅程",
  description: "关键词趋势 → Listing 生成 → 生图素材 → 渠道上架，跨平台上架流水线",
  icon: PackagePlus,
  order: 2,
  enabled: true,
  featured: true,
  steps: [
    {
      id: "trend",
      label: "关键词趋势",
      description: "看行业热词与长尾词，确定要打的关键词",
      workspaceId: "insight",
      href: "/b2b/keyword-trends?journey=listing-launch&step=1",
      agentHint: "可用 generateLongTails 动作按行业生成长尾词",
      handleSelector: "[data-agent-action=\"journey-next\"]",
    },
    {
      id: "listing",
      label: "Listing 生成",
      description: "用选定关键词生成标题、卖点与五点描述",
      workspaceId: "listing-ops",
      href: "/b2b/listing?journey=listing-launch&step=2",
      handleSelector: "[data-agent-action=\"journey-next\"]",
    },
    {
      id: "imaging",
      label: "生图素材",
      description: "生图 Skill 库产出主图与场景图",
      workspaceId: "listing-ops",
      href: "/b2b/image-skills?journey=listing-launch&step=3",
      handleSelector: "[data-agent-action=\"journey-next\"]",
    },
    {
      id: "channels",
      label: "渠道上架",
      description: "确认渠道账号会话可用，推送商品上架",
      workspaceId: "listing-ops",
      href: "/b2b/channels?journey=listing-launch&step=4",
    },
  ],
};
