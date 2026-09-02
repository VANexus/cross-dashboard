// lib/journeys/manifests/xhs-seed-pipeline.ts — 小红书种草流水线旅程（PRD v0.2）
import { Flame } from "lucide-react";
import type { JourneyManifest } from "../types";

export const xhsSeedPipelineJourney: JourneyManifest = {
  id: "xhs-seed-pipeline",
  label: "小红书种草流水线",
  description: "热榜选题 → 种草创作 → 3:4 配图 → 合规审计 → 发布就绪，小红书种草端到端",
  icon: Flame,
  order: 2,
  enabled: true,
  featured: true,
  steps: [
    {
      id: "hot-insight",
      label: "选题洞察",
      description: "热榜引擎多榜归一化选题（综合/垂类/话题/灵感），锁定种草方向",
      workspaceId: "content-workshop",
      href: "/content-studio?journey=xhs-seed-pipeline&step=1",
      agentHint: "热榜引擎面板可用 hot-boards-refresh 动作刷新；品类偏好命中垂类榜加权；选题卡点击自动预填主题",
      handleSelector: "[data-agent-action=\"journey-next\"]",
    },
    {
      id: "seed-create",
      label: "种草创作",
      description: "一键生成小红书种草思路 + 平台化文案（标题/正文/话题）",
      workspaceId: "content-workshop",
      href: "/content-studio?journey=xhs-seed-pipeline&step=2",
      agentHint: "可用 oneKeyGenerate 动作（subject=选题主题）直接生成思路 + 文案",
      handleSelector: "[data-agent-action=\"journey-next\"]",
    },
    {
      id: "xhs-image",
      label: "3:4 配图",
      description: "AI 配图按小红书 3:4 比例出图，挂接种草草稿",
      workspaceId: "content-workshop",
      href: "/content-studio?journey=xhs-seed-pipeline&step=3",
      agentHint: "可用 fill 动作填画面描述后 click [data-agent-action=\"image-generate\"]",
      handleSelector: "[data-agent-action=\"journey-next\"]",
    },
    {
      id: "xhs-audit",
      label: "合规审计",
      description: "小红书/广告法规则扫描 + AI 复核，风险词标红出替换建议",
      workspaceId: "content-workshop",
      href: "/content-studio?journey=xhs-seed-pipeline&step=3",
      agentHint: "可用 studio-audit 动作跑审计，通过后进入发布步",
      handleSelector: "[data-agent-action=\"journey-next\"]",
    },
    {
      id: "xhs-publish",
      label: "发布就绪",
      description: "发布就绪卡：一键复制完整笔记 + 配图打包下载，粘贴到小红书 App",
      workspaceId: "content-workshop",
      href: "/content-studio?journey=xhs-seed-pipeline&step=4",
      agentHint: "就绪卡可用 xhs-copy-all 动作复制完整笔记；配图可打包下载",
    },
  ],
};
