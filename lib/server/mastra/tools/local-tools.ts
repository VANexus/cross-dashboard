/**
 * lib/mastra/tools/local-tools.ts
 *
 * 从 lib/orchestrator/tool-registry.ts 迁移的 9 个本地工具,改用 @mastra/core 的
 * createTool(zod inputSchema)。execute 原样复用 lib/services 的 WorkflowService 调用,
 * 业务逻辑不重写(原 tool-registry 已随旧手写编排链路一并删除)。
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { WorkflowService } from '@/lib/server/services';

// ── Singleton WorkflowService ──────────────────────────────────

let _wfService: WorkflowService | null = null;
function getWorkflowService(): WorkflowService {
  if (!_wfService) _wfService = new WorkflowService();
  return _wfService;
}

// ── workflow 复用的执行函数(工具 execute 与 workflow 步骤共用)──

/** listing_generate 的执行体,workflow「Listing 流水线」步骤复用。 */
export async function runListingGenerate(input: {
  keyword: string;
  category?: string;
  language?: string;
}) {
  const svc = getWorkflowService();
  const r = await svc.generateListing({
    keyword: input.keyword,
    category: input.category,
    language: input.language,
  });
  const res = (r.result ?? {}) as Record<string, unknown>;
  return {
    id: r.id,
    title: String(res.title ?? ''),
    bullets: Array.isArray(res.bullets) ? res.bullets.map((b) => String(b)) : [],
    description: String(res.description ?? ''),
    searchTerms: Array.isArray(res.searchTerms) ? res.searchTerms.map((s) => String(s)) : [],
    seoScore: typeof res.seoScore === 'number' ? res.seoScore : 0,
    estimatedCtr: String(res.estimatedCTR ?? ''),
  };
}

/** imaging_generate 的执行体,workflow「Listing 流水线」生图步骤复用。 */
export async function runImagingGenerate(input: {
  prompt: string;
  type: 'main' | 'scene' | 'aplus';
  count?: number;
}) {
  const svc = getWorkflowService();
  const r = await svc.generateImage({
    type: input.type,
    prompt: input.prompt,
    count: input.count ? Math.min(6, Math.max(1, input.count)) : undefined,
  });
  const raw = r.result;
  const arr = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
  return arr.map((img) => ({
    url: String(img?.url ?? ''),
    revisedPrompt: typeof img?.revisedPrompt === 'string' ? img.revisedPrompt : null,
    model: typeof img?.model === 'string' ? img.model : null,
  }));
}

// ── 9 个本地工具(createTool 迁移版)─────────────────────────────

export const competitorAnalyzeTool = createTool({
  id: 'competitor_analyze',
  description: '分析指定 ASIN 的竞品数据，包括排名、价格、卖点、广告位势等。输入一个或多个 ASIN，返回竞品分析报告。',
  inputSchema: z.object({
    asins: z.string().describe('要分析的竞品 ASIN 列表（逗号分隔），例如：B08N5WRWNW,B09XYZ1234'),
    marketplace: z.enum(['US', 'UK', 'DE', 'JP', 'AU']).optional().describe('目标站点，默认 US'),
    keywords: z.string().optional().describe('关注关键词（逗号分隔，可选）'),
  }),
  execute: async (input) => {
    const svc = getWorkflowService();
    const asins = input.asins.split(',').map((s) => s.trim()).filter(Boolean);
    const keywords = input.keywords
      ? input.keywords.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    return (await svc.analyzeCompetitor({ asins, marketplace: input.marketplace ?? 'US', keywords })) as unknown as Record<string, unknown>;
  },
});

export const adAnalyzeTool = createTool({
  id: 'ad_analyze',
  description: '查看广告关键词的表现数据，包括展示量、点击量、花费、销售额、ACoS、转化率等。',
  inputSchema: z.object({
    type: z.enum(['high', 'medium', 'low', 'opportunity']).optional().describe('关键词类型筛选'),
    tag: z.string().optional().describe('标签筛选'),
  }),
  execute: async (input) => {
    const svc = getWorkflowService();
    const keywords = await svc.getAdKeywords({ type: input.type, tag: input.tag });
    return { keywords, total: keywords.length };
  },
});

export const adOptimizeTool = createTool({
  id: 'ad_optimize',
  description: '基于 AI 分析优化广告策略，包括关键词出价调整、匹配类型优化、预算分配建议。',
  inputSchema: z.object({
    keywords: z.string().optional().describe('要优化的关键词（逗号分隔，可选，不填则优化全部）'),
    asin: z.string().optional().describe('目标 ASIN（可选）'),
    marketplace: z.enum(['US', 'UK', 'DE', 'JP']).optional().describe('目标站点'),
    budget: z.number().optional().describe('日预算（美元，可选）'),
  }),
  execute: async (input) => {
    const svc = getWorkflowService();
    const keywords = input.keywords
      ? input.keywords.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    return (await svc.optimizeAdStrategy({
      keywords,
      asin: input.asin,
      marketplace: input.marketplace,
      budget: input.budget,
    })) as unknown as Record<string, unknown>;
  },
});

export const listingGenerateTool = createTool({
  id: 'listing_generate',
  description: '基于产品信息生成优化的 Amazon Listing，包含标题、五点描述、后台搜索词。',
  inputSchema: z.object({
    keyword: z.string().describe('产品核心关键词或名称'),
    category: z.string().optional().describe('产品类目（可选）'),
    language: z.enum(['en', 'zh', 'de', 'jp']).optional().describe('语言'),
  }),
  execute: async (input) => {
    return (await runListingGenerate(input)) as unknown as Record<string, unknown>;
  },
});

export const listingCategoryTool = createTool({
  id: 'listing_category',
  description: '基于产品关键词推荐最佳 Amazon 类目，包含 BSR、竞争度、佣金费率等信息。',
  inputSchema: z.object({}),
  execute: async () => {
    const svc = getWorkflowService();
    const recs = await svc.getCategoryRecs();
    return { recommendations: recs, count: recs.length };
  },
});

export const listingInfringementTool = createTool({
  id: 'listing_infringement',
  description: '检测标题/描述中的侵权风险词，包括品牌词、专利词等。',
  inputSchema: z.object({
    text: z.string().describe('要检测的文案内容（标题或描述）'),
  }),
  execute: async (input) => {
    const svc = getWorkflowService();
    const words = await svc.getInfringementWords();
    const text = input.text.toLowerCase();
    const hits = words.filter((w) => text.includes(w.word.toLowerCase()));
    return {
      checked: text.length,
      hits,
      riskLevel: hits.length > 3 ? 'high' : hits.length > 0 ? 'medium' : 'low',
    };
  },
});

export const imagingGenerateTool = createTool({
  id: 'imaging_generate',
  description: '基于产品关键词生成 AI 产品图片（主图、场景图、A+图），含评分。',
  inputSchema: z.object({
    prompt: z.string().describe('图片生成提示词（产品描述或关键词）'),
    type: z.enum(['main', 'scene', 'aplus']).describe('图片类型'),
    count: z.number().optional().describe('生成数量（1-6）'),
  }),
  execute: async (input) => {
    const svc = getWorkflowService();
    return (await svc.generateImage({
      type: input.type,
      prompt: input.prompt,
      count: input.count ? Math.min(6, Math.max(1, input.count)) : undefined,
    })) as unknown as Record<string, unknown>;
  },
});

export const inventoryRestockTool = createTool({
  id: 'inventory_restock',
  description: '基于库存数据和销售趋势生成补货建议，包含紧急程度、最优补货量、预估成本。',
  inputSchema: z.object({}),
  execute: async () => {
    const svc = getWorkflowService();
    return (await svc.generateRestockSuggestions()) as unknown as Record<string, unknown>;
  },
});

export const productResearchTool = createTool({
  id: 'product_research',
  description: '基于关键词进行选品调研，发现高潜力产品和市场机会。需要指定数据源和关键词。',
  inputSchema: z.object({
    keywords: z.string().describe('调研关键词（逗号分隔）'),
    marketplace: z.enum(['US', 'UK', 'DE', 'JP']).optional().describe('目标站点'),
    category: z.string().optional().describe('产品类目（可选）'),
    sources: z.string().optional().describe('数据源（逗号分隔，可选）'),
  }),
  execute: async (input) => {
    const svc = getWorkflowService();
    const keywords = input.keywords.split(',').map((s) => s.trim()).filter(Boolean);
    const sources = input.sources
      ? input.sources.split(',').map((s) => s.trim()).filter(Boolean)
      : ['amazon'];
    return (await svc.executeResearch({
      keywords,
      marketplace: input.marketplace ?? 'US',
      category: input.category,
      sources,
    })) as unknown as Record<string, unknown>;
  },
});

/** 工具清单(供未来 agent 挂载/遍历)。 */
export const localTools = {
  competitor_analyze: competitorAnalyzeTool,
  ad_analyze: adAnalyzeTool,
  ad_optimize: adOptimizeTool,
  listing_generate: listingGenerateTool,
  listing_category: listingCategoryTool,
  listing_infringement: listingInfringementTool,
  imaging_generate: imagingGenerateTool,
  inventory_restock: inventoryRestockTool,
  product_research: productResearchTool,
};
