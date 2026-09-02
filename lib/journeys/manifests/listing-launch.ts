// lib/journeys/manifests/listing-launch.ts — J2 TikTok·国际站铺货旅程
import { PackagePlus } from "lucide-react";
import type { JourneyManifest } from "../types";

export const listingLaunchJourney: JourneyManifest = {
  id: "listing-launch",
  label: "TikTok·国际站铺货旅程",
  description: "TikTok 热词选品 → Listing 生成 → 主图素材 → 国际站上架，铺货模式端到端流水线",
  icon: PackagePlus,
  order: 2,
  enabled: true,
  featured: true,
  steps: [
    {
      id: "trend",
      label: "TikTok 热词选品",
      description: "看 TikTok/国际站行业热词与长尾词，圈定要铺的品与关键词",
      workspaceId: "insight",
      href: "/b2b/keyword-trends?journey=listing-launch&step=1",
      agentHint: "可用 switchPlatform 切到 tiktok/alibaba，用 generateLongTails 按行业生成长尾词",
      handleSelector: "[data-agent-action=\"journey-next\"]",
    },
    {
      id: "listing",
      label: "Listing 生成",
      description: "按选定关键词批量生成标题、卖点与关键词（发社媒/发国际站）",
      workspaceId: "listing-ops",
      href: "/b2b/listing?journey=listing-launch&step=2",
      agentHint: "可用 recommendToday 出 TOP5、generateListingDraft 生成草稿；publishListingToAlibaba 是 L2 需用户确认",
      handleSelector: "[data-agent-action=\"journey-next\"]",
    },
    {
      id: "imaging",
      label: "主图素材",
      description: "反推爆款封面、固化生图 Skill，批量产出铺货主图/场景图",
      workspaceId: "listing-ops",
      href: "/b2b/image-skills?journey=listing-launch&step=3",
      agentHint: "可用 reverseCoverPrompt 反推提示词、generateWithSkillAction 按 Skill 出图",
      handleSelector: "[data-agent-action=\"journey-next\"]",
    },
    {
      id: "channels",
      label: "渠道上架",
      description: "确认 TikTok/国际站渠道账号可用，回到 Listing 页批准上传",
      workspaceId: "listing-ops",
      href: "/b2b/channels?journey=listing-launch&step=4",
      agentHint: "可用 listChannelAccounts 只读核对账号状态；真正上传国际站回 Listing 页走 L2 确认",
    },
  ],
};
