// lib/journeys/manifests/content-publish.ts — J1 内容发布旅程
import { PenLine } from "lucide-react";
import type { JourneyManifest } from "../types";

export const contentPublishJourney: JourneyManifest = {
  id: "content-publish",
  label: "内容发布旅程",
  description: "趋势洞察 → 选题创作 → 审计配图 → 公众号发布，端到端内容流水线",
  icon: PenLine,
  order: 1,
  enabled: true,
  featured: true,
  steps: [
    {
      id: "trend",
      label: "洞察趋势",
      description: "在关键词趋势页看平台热词与长尾词，锁定选题方向",
      workspaceId: "insight",
      href: "/b2b/keyword-trends?journey=content-publish&step=1",
      agentHint: "可用 generateLongTails 动作按行业生成长尾词；readKpi 类页面动作可读趋势摘要",
      handleSelector: "[data-agent-action=\"journey-next\"]",
    },
    {
      id: "create",
      label: "选题创作",
      description: "在内容创作中心一键生成思路与平台化文案",
      workspaceId: "content-workshop",
      href: "/content-studio?journey=content-publish&step=2",
      agentHint: "可用 oneKeyGenerate 动作直接生成思路 + 文案",
      handleSelector: "[data-agent-action=\"journey-next\"]",
    },
    {
      id: "audit-image",
      label: "审计与配图",
      description: "跑平台规则审计，AI 配图按平台比例出图挂接草稿",
      workspaceId: "content-workshop",
      href: "/content-studio?journey=content-publish&step=3",
      agentHint: "可用 fill 动作填画面描述后 click [data-agent-action=\"image-generate\"]",
      handleSelector: "[data-agent-action=\"journey-next\"]",
    },
    {
      id: "publish",
      label: "发布",
      description: "公众号端到端发布：排版、预览、群发",
      workspaceId: "content-workshop",
      href: "/content-studio/wechat?journey=content-publish&step=4",
      agentHint: "发布页支持点击与填充动作驱动排版与发送",
    },
  ],
};
