/**
 * FlowMind — 技能演示清单（Demo Manifest）
 *
 * 在 flowmind 后端（/api/v1/manifest）不可达时，提供一组结构完整、
 * 输出形态多样的示例技能，驱动「通用技能页」渲染出不同的富模块组合。
 * 仅用于演示/离线预览，与后端的 AI_DEMO_MODE 语义一致。
 *
 * 设计意图：同一个「通用渲染器」吃进不同 output 结构 → 产出
 * 指标卡 / 数据表 / 柱状图 / 面积图 / 键值对 / 标签云 / 代码块等
 * 不同模块，从而体现「通用但多样、功能丰富」。
 */
import type { DiscoveredSkill } from "./types";

/** 演示技能：在 DiscoveredSkill 之上补充领域色 key 与示例输出数据 */
export interface DemoSkill extends DiscoveredSkill {
  /** 工作流领域色 key（映射 --wf-* token）：product/imaging/ad/listing/inventory/competitor/localize */
  domain: string;
  /** 示例输出（后端未就绪时驱动输出渲染） */
  demoOutput: unknown;
}

/** 领域色 key → 前缀（配合 Tailwind `text-*` / `bg-*` 类） */
export const DOMAIN_TO_WF: Record<string, string> = {
  product: "wf-product",
  imaging: "wf-imaging",
  ad: "wf-ad",
  listing: "wf-listing",
  inventory: "wf-inventory",
  competitor: "wf-competitor",
  localize: "wf-localize",
};

/**
 * 领域色 → 完整静态 Tailwind 类（字面量，保证 Tailwind JIT 能扫描到）。
 * chip 用于图标底/文字，bar 用于进度条/状态点。
 */
export interface DomainStyle {
  chip: string;
  bar: string;
}
export const DOMAIN_STYLE: Record<string, DomainStyle> = {
  product: { chip: "bg-wf-product/15 text-wf-product", bar: "bg-wf-product" },
  imaging: { chip: "bg-wf-imaging/15 text-wf-imaging", bar: "bg-wf-imaging" },
  ad: { chip: "bg-wf-ad/15 text-wf-ad", bar: "bg-wf-ad" },
  listing: { chip: "bg-wf-listing/15 text-wf-listing", bar: "bg-wf-listing" },
  inventory: { chip: "bg-wf-inventory/15 text-wf-inventory", bar: "bg-wf-inventory" },
  competitor: { chip: "bg-wf-competitor/15 text-wf-competitor", bar: "bg-wf-competitor" },
  localize: { chip: "bg-wf-localize/15 text-wf-localize", bar: "bg-wf-localize" },
  primary: { chip: "bg-primary/15 text-primary", bar: "bg-primary" },
};

/** 取领域样式（未知领域回退主色） */
export function domainStyle(domain?: string): DomainStyle {
  return DOMAIN_STYLE[domain ?? "primary"] ?? DOMAIN_STYLE.primary;
}

const DEMO_SKILLS: DemoSkill[] = [
  {
    id: "product-research",
    name: "选品分析",
    version: "v1.4.0",
    description: "数据源管理、关键词挖掘与用户痛点识别，输出结构化选品报告。",
    tags: ["选品", "关键词", "痛点"],
    domain: "product",
    reliability_profile: {
      deterministic: true,
      emits_reasoning_chain: true,
      typical_latency_ms: 2100,
      confidence: 0.89,
    },
    input_schema: {
      type: "object",
      title: "选品分析参数",
      required: ["query", "region"],
      properties: {
        query: { type: "string", title: "分析目标", description: "例如：厨房类目不锈钢厨具的选品机会", format: "textarea" },
        region: { type: "string", title: "目标站点", enum: ["美国", "德国", "日本", "英国"], default: "美国" },
        depth: { type: "string", title: "分析深度", enum: ["快速", "标准", "深度"], default: "标准" },
      },
    },
    output_schema: {
      type: "object",
      properties: {
        total_keywords: { type: "integer", title: "关键词总数" },
        avg_confidence: { type: "number", title: "平均置信度" },
        pain_points: { type: "array", title: "用户痛点", items: { type: "object" } },
        keyword_cloud: { type: "array", title: "关键词云", items: { type: "string" } },
        report: { type: "string", title: "选品报告" },
      },
    },
    demoOutput: {
      total_keywords: 128,
      avg_confidence: 0.89,
      pain_points: [
        { pain: "易生锈、难清洁", count: 342, opportunity: "高", product: "不锈钢沥水架" },
        { pain: "收纳占空间", count: 288, opportunity: "高", product: "可折叠厨具" },
        { pain: "涂层脱落不安全", count: 201, opportunity: "中", product: "陶瓷不粘锅" },
        { pain: "噪音大", count: 156, opportunity: "中", product: "静音破壁机" },
      ],
      keyword_cloud: [
        "stainless steel", "non-stick", "foldable", "bpa-free", "easy clean",
        "dishwasher safe", "space saving", "eco-friendly", "durable", "premium",
      ],
      report:
        "# 厨房类目选品报告\n\n## 结论\n不锈钢 + 易清洁是当前高转化卖点，建议优先切入「沥水架 / 可折叠收纳」两个细分。\n\n## 风险\n涂层类产品投诉集中在脱落，需在文案中明确材质与保养说明。",
    },
  },
  {
    id: "ai-advertising",
    name: "AI 广告",
    version: "v1.2.3",
    description: "关键词优化、ACOS 归因与广告位监控，输出出价建议。",
    tags: ["广告", "ACOS", "出价"],
    domain: "ad",
    reliability_profile: {
      deterministic: false,
      emits_reasoning_chain: true,
      typical_latency_ms: 1900,
      confidence: 0.87,
    },
    input_schema: {
      type: "object",
      required: ["campaign"],
      properties: {
        campaign: { type: "string", title: "广告活动", description: "例如：SP-kitchen-2026" },
        window: { type: "string", title: "统计窗口", enum: ["近 7 天", "近 30 天"], default: "近 7 天" },
      },
    },
    output_schema: {
      type: "object",
      properties: {
        acos: { type: "number", title: "ACOS" },
        spend: { type: "number", title: "花费" },
        sales: { type: "number", title: "销售额" },
        keyword_groups: { type: "array", title: "关键词分组", items: { type: "object" } },
        trend: { type: "array", title: "ACOS 趋势", items: { type: "object" } },
      },
    },
    demoOutput: {
      acos: 0.24,
      spend: 1320,
      sales: 5500,
      keyword_groups: [
        { group: "kitchen essentials", clicks: 1840, spend: 412, acos: 0.21 },
        { group: "stainless steel", clicks: 1205, spend: 356, acos: 0.26 },
        { group: "foldable storage", clicks: 860, spend: 248, acos: 0.19 },
        { group: "non-stick pan", clicks: 640, spend: 214, acos: 0.31 },
        { group: "eco friendly", clicks: 320, spend: 90, acos: 0.35 },
      ],
      trend: [
        { date: "08-21", acos: 0.31 }, { date: "08-22", acos: 0.29 },
        { date: "08-23", acos: 0.27 }, { date: "08-24", acos: 0.28 },
        { date: "08-25", acos: 0.25 }, { date: "08-26", acos: 0.24 },
        { date: "08-27", acos: 0.24 },
      ],
    },
  },
  {
    id: "ai-listing",
    name: "AI 上架",
    version: "v1.3.0",
    description: "Listing 生成、Bullet Points 提炼、侵权检测与类目推荐。",
    tags: ["Listing", "卖点", "侵权"],
    domain: "listing",
    reliability_profile: {
      deterministic: true,
      emits_reasoning_chain: false,
      typical_latency_ms: 3400,
      confidence: 0.82,
    },
    input_schema: {
      type: "object",
      required: ["product"],
      properties: {
        product: { type: "string", title: "商品信息", description: "粘贴商品名、卖点与规格", format: "textarea" },
        tone: { type: "string", title: "文案语气", enum: ["专业克制", "活泼生动", "高端简约"], default: "专业克制" },
      },
    },
    output_schema: {
      type: "object",
      properties: {
        title: { type: "string", title: "标题" },
        bullets: { type: "array", title: "Bullet Points", items: { type: "string" } },
        category: { type: "string", title: "推荐类目" },
        infringement_score: { type: "number", title: "侵权风险分" },
        checks: { type: "object", title: "合规检测" },
      },
    },
    demoOutput: {
      title: "Stainless Steel Dish Rack - Large Drainboard, Rustproof, Kitchen Counter Organizer",
      bullets: [
        "Premium 304 stainless steel - rustproof and food-grade safe",
        "Large capacity drainboard holds up to 12 plates",
        "Space-saving compact design fits most countertops",
        "Easy to clean - fully dishwasher safe",
      ],
      category: "Home & Kitchen > Kitchen Storage & Organization > Dish Racks",
      infringement_score: 0.08,
      checks: {
        infringement: { passed: true, hits: 0 },
        keyword_duplicate: { passed: true, overlap: 0.12 },
        category_match: { passed: true, confidence: 0.96 },
      },
    },
  },
  {
    id: "inventory",
    name: "库销比",
    version: "v1.2.0",
    description: "库存监控、库销比计算、补货建议与缺货预警。",
    tags: ["库存", "补货", "预警"],
    domain: "inventory",
    reliability_profile: {
      deterministic: true,
      emits_reasoning_chain: false,
      typical_latency_ms: 800,
      confidence: 0.9,
    },
    input_schema: {
      type: "object",
      required: ["horizon"],
      properties: {
        sku_prefix: { type: "string", title: "SKU 前缀", description: "留空表示全店" },
        horizon: { type: "integer", title: "预测天数", default: 30 },
      },
    },
    output_schema: {
      type: "object",
      properties: {
        summary: { type: "object", title: "汇总" },
        skus: { type: "array", title: "SKU 明细", items: { type: "object" } },
      },
    },
    demoOutput: {
      summary: { healthy: 42, warning: 9, critical: 3 },
      skus: [
        { sku: "SKU-2091", ratio: 1.8, status: "warning", suggestion: "建议 7 天内补货 300 件" },
        { sku: "SKU-1284", ratio: 0.6, status: "critical", suggestion: "缺货风险，立即补货 500 件" },
        { sku: "SKU-3372", ratio: 4.2, status: "healthy", suggestion: "库存充足" },
        { sku: "SKU-4421", ratio: 2.9, status: "healthy", suggestion: "库存健康" },
        { sku: "SKU-5087", ratio: 1.1, status: "warning", suggestion: "建议补货 180 件" },
        { sku: "SKU-6610", ratio: 0.9, status: "critical", suggestion: "立即补货 220 件" },
      ],
    },
  },
];

export function getDemoSkills(): DemoSkill[] {
  return DEMO_SKILLS;
}

export function getDemoSkill(id: string): DemoSkill | undefined {
  return DEMO_SKILLS.find((s) => s.id === id);
}
