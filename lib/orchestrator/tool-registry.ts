/**
 * FlowMind AI Orchestrator — Tool Registry
 *
 * Backend-driven tool registry. Each workflow tool registers itself
 * with schema + execute function. The AI sees these as callable tools.
 * Frontend has zero knowledge of specific tools — it renders whatever
 * the backend returns.
 *
 * To add a new tool: add an entry here. No frontend changes needed.
 */

import type { ToolDefinition, ToolParameter } from "./types";
import { WorkflowService } from "@/lib/services";

// ── Parameter Builders ───────────────────────────────────────────

function stringParam(name: string, desc: string, required = true, enumVals?: string[]): ToolParameter {
  return { name, type: "string", description: desc, required, enum: enumVals };
}

function numberParam(name: string, desc: string, required = true): ToolParameter {
  return { name, type: "number", description: desc, required };
}

// ── Singleton WorkflowService ────────────────────────────────────

let _wfService: WorkflowService | null = null;
function getWorkflowService(): WorkflowService {
  if (!_wfService) _wfService = new WorkflowService();
  return _wfService;
}

// ── Tool Registry ────────────────────────────────────────────────

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    id: "competitor_analyze",
    name: "竞品分析",
    description: "分析指定 ASIN 的竞品数据，包括排名、价格、卖点、广告位势等。输入一个或多个 ASIN，返回竞品分析报告。",
    parameters: [
      stringParam("asins", "要分析的竞品 ASIN 列表（逗号分隔），例如：B08N5WRWNW,B09XYZ1234"),
      stringParam("marketplace", "目标站点，默认 US", false, ["US", "UK", "DE", "JP", "AU"]),
      stringParam("keywords", "关注关键词（逗号分隔，可选）", false),
    ],
    execute: async (params) => {
      const svc = getWorkflowService();
      const asins = String(params.asins || "").split(",").map((s) => s.trim()).filter(Boolean);
      const marketplace = String(params.marketplace || "US");
      const keywords = params.keywords
        ? String(params.keywords).split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
      const result = await svc.analyzeCompetitor({ asins, marketplace, keywords });
      return result as unknown as Record<string, unknown>;
    },
  },
  {
    id: "ad_analyze",
    name: "广告关键词分析",
    description: "查看广告关键词的表现数据，包括展示量、点击量、花费、销售额、ACoS、转化率等。",
    parameters: [
      stringParam("type", "关键词类型筛选", false, ["high", "medium", "low", "opportunity"]),
      stringParam("tag", "标签筛选", false),
    ],
    execute: async (params) => {
      const svc = getWorkflowService();
      const keywords = await svc.getAdKeywords({
        type: params.type ? String(params.type) : undefined,
        tag: params.tag ? String(params.tag) : undefined,
      });
      return { keywords, total: keywords.length } as unknown as Record<string, unknown>;
    },
  },
  {
    id: "ad_optimize",
    name: "广告策略优化",
    description: "基于 AI 分析优化广告策略，包括关键词出价调整、匹配类型优化、预算分配建议。",
    parameters: [
      stringParam("keywords", "要优化的关键词（逗号分隔，可选，不填则优化全部）", false),
      stringParam("asin", "目标 ASIN（可选）", false),
      stringParam("marketplace", "目标站点", false, ["US", "UK", "DE", "JP"]),
      numberParam("budget", "日预算（美元，可选）", false),
    ],
    execute: async (params) => {
      const svc = getWorkflowService();
      const keywords = params.keywords
        ? String(params.keywords).split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
      const result = await svc.optimizeAdStrategy({
        keywords,
        asin: params.asin ? String(params.asin) : undefined,
        marketplace: params.marketplace ? String(params.marketplace) : undefined,
        budget: params.budget ? Number(params.budget) : undefined,
      });
      return result as unknown as Record<string, unknown>;
    },
  },
  {
    id: "listing_generate",
    name: "Listing 生成",
    description: "基于产品信息生成优化的 Amazon Listing，包含标题、五点描述、后台搜索词。",
    parameters: [
      stringParam("keyword", "产品核心关键词或名称", true),
      stringParam("category", "产品类目（可选）", false),
      stringParam("language", "语言", false, ["en", "zh", "de", "jp"]),
    ],
    execute: async (params) => {
      const svc = getWorkflowService();
      const result = await svc.generateListing({
        keyword: String(params.keyword || ""),
        category: params.category ? String(params.category) : undefined,
        language: params.language ? String(params.language) : undefined,
      });
      return result as unknown as Record<string, unknown>;
    },
  },
  {
    id: "listing_category",
    name: "类目推荐",
    description: "基于产品关键词推荐最佳 Amazon 类目，包含 BSR、竞争度、佣金费率等信息。",
    parameters: [],
    execute: async () => {
      const svc = getWorkflowService();
      const recs = await svc.getCategoryRecs();
      return { recommendations: recs, count: recs.length } as unknown as Record<string, unknown>;
    },
  },
  {
    id: "listing_infringement",
    name: "侵权检测",
    description: "检测标题/描述中的侵权风险词，包括品牌词、专利词等。",
    parameters: [
      stringParam("text", "要检测的文案内容（标题或描述）", true),
    ],
    execute: async (params) => {
      const svc = getWorkflowService();
      const words = await svc.getInfringementWords();
      const text = String(params.text).toLowerCase();
      const hits = words.filter((w) => text.includes(w.word.toLowerCase()));
      return {
        checked: text.length,
        hits,
        riskLevel: hits.length > 3 ? "high" : hits.length > 0 ? "medium" : "low",
      } as unknown as Record<string, unknown>;
    },
  },
  {
    id: "imaging_generate",
    name: "AI 作图",
    description: "基于产品关键词生成 AI 产品图片（主图、场景图、A+图），含评分。",
    parameters: [
      stringParam("prompt", "图片生成提示词（产品描述或关键词）", true),
      stringParam("type", "图片类型", true, ["main", "scene", "aplus"]),
      numberParam("count", "生成数量（1-6）", false),
    ],
    execute: async (params) => {
      const svc = getWorkflowService();
      const result = await svc.generateImage({
        type: String(params.type),
        prompt: String(params.prompt),
        count: Math.min(6, Math.max(1, Number(params.count || 4))),
      });
      return result as unknown as Record<string, unknown>;
    },
  },
  {
    id: "inventory_restock",
    name: "库存补货建议",
    description: "基于库存数据和销售趋势生成补货建议，包含紧急程度、最优补货量、预估成本。",
    parameters: [],
    execute: async () => {
      const svc = getWorkflowService();
      const result = await svc.generateRestockSuggestions();
      return result as unknown as Record<string, unknown>;
    },
  },
  {
    id: "product_research",
    name: "选品调研",
    description: "基于关键词进行选品调研，发现高潜力产品和市场机会。需要指定数据源和关键词。",
    parameters: [
      stringParam("keywords", "调研关键词（逗号分隔）", true),
      stringParam("marketplace", "目标站点", false, ["US", "UK", "DE", "JP"]),
      stringParam("category", "产品类目（可选）", false),
      stringParam("sources", "数据源（逗号分隔，可选）", false),
    ],
    execute: async (params) => {
      const svc = getWorkflowService();
      const keywords = String(params.keywords).split(",").map((s) => s.trim()).filter(Boolean);
      const sources = params.sources
        ? String(params.sources).split(",").map((s) => s.trim()).filter(Boolean)
        : ["amazon"];
      const result = await svc.executeResearch({
        keywords,
        marketplace: String(params.marketplace || "US"),
        category: params.category ? String(params.category) : undefined,
        sources,
      });
      return result as unknown as Record<string, unknown>;
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────

export function getToolById(id: string): ToolDefinition | undefined {
  return TOOL_REGISTRY.find((t) => t.id === id);
}

export function getToolName(id: string): string {
  return TOOL_REGISTRY.find((t) => t.id === id)?.name ?? id;
}

/**
 * Convert tool registry to OpenAI/Claude function-calling format.
 * Returns tool definitions suitable for the AI API's `tools` parameter.
 */
export function toolsForAI(): Record<string, unknown>[] {
  return TOOL_REGISTRY.map((tool) => ({
    name: tool.id,
    description: tool.description,
    input_schema: buildJsonSchema(tool.parameters),
  }));
}

function buildJsonSchema(params: ToolParameter[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const p of params) {
    if (!p.required && p.default === undefined) {
      // Optional params still listed but not in required
    }
    const prop: Record<string, unknown> = { type: p.type, description: p.description };
    if (p.enum) prop.enum = p.enum;
    if (p.default !== undefined) prop.default = p.default;
    properties[p.name] = prop;
    if (p.required) required.push(p.name);
  }

  return {
    type: "object",
    properties,
    required,
  };
}
