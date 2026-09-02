// lib/journeys/manifests/skeletons.ts — 骨架旅程（enabled=false，仅编排中心展示）
import { Target, Boxes, Globe, Radar } from "lucide-react";
import type { JourneyManifest } from "../types";

export const skeletonJourneys: JourneyManifest[] = [
  {
    id: "competitor-ads",
    label: "竞品投放旅程",
    description: "竞品广告分析 → AI 广告投放策略生成",
    icon: Target,
    order: 10,
    enabled: false,
    steps: [
      {
        id: "analyze",
        label: "竞品分析",
        description: "抓取竞品广告素材与投放策略",
        workspaceId: "growth",
        href: "/workflows/competitor-ads",
      },
      {
        id: "deploy",
        label: "AI 广告投放",
        description: "基于竞品洞察生成投放方案",
        workspaceId: "growth",
        href: "/workflows/ai-advertising",
      },
    ],
  },
  {
    id: "inventory-health",
    label: "库销健康旅程",
    description: "库销比监控 → 补货/清仓决策",
    icon: Boxes,
    order: 11,
    enabled: false,
    steps: [
      {
        id: "monitor",
        label: "库销监控",
        description: "查看库销比与滞销预警",
        workspaceId: "growth",
        href: "/workflows/inventory",
      },
    ],
  },
  {
    id: "video-localization",
    label: "视频本地化旅程",
    description: "素材上传 → 多语言翻译 → 本地化发布",
    icon: Globe,
    order: 12,
    enabled: false,
    steps: [
      {
        id: "localize",
        label: "视频本地化",
        description: "多语言配音与字幕本地化",
        workspaceId: "growth",
        href: "/workflows/video-localization",
      },
    ],
  },
  {
    id: "product-research",
    label: "选品研究旅程",
    description: "市场雷达 → 选品报告 → 进入上架旅程",
    icon: Radar,
    order: 13,
    enabled: false,
    steps: [
      {
        id: "research",
        label: "选品研究",
        description: "市场雷达扫描与选品评分",
        workspaceId: "growth",
        href: "/workflows/product-research",
      },
    ],
  },
];
