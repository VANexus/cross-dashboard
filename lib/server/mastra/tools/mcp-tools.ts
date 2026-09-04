/**
 * lib/mastra/tools/mcp-tools.ts
 *
 * 趋势 / 长尾 / 生图 三能力已迁移为 Next.js 全栈自举（lib/server/services/b2b.selfhost.ts）：
 * - b2b_trends   → TikHub REST（AI_TRENDS_API_*），保留 B2BService 的 IG 词池轮换 / 缓存降级语义
 * - b2b_longtail → 云 LLM 结构化生成（AI_LLM_* 网关）
 * - image_generate → OpenAI 兼容 images/generations（AI_IMAGE_API_*，SiliconFlow）
 *
 * 仍走 flowmind MCP 的仅剩阿里域（alibaba_product_list/recommend/listing_generate/product_post，
 * 需 Alibaba OpenAPI 平台授权）与 image_prompt_reverse / 推送 / 每日摘要编排。
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { ContentMCPClient } from '@/lib/mcp/client';
import { B2BService } from '@/lib/server/services';
import { generateImages as selfhostGenerateImages } from '@/lib/server/services/b2b.selfhost';
import type { TrendPlatform } from '@/lib/shared/types';

// ── 单例(同 lib/services 模式)────────────────────────────────

let _b2b: B2BService | null = null;
function getB2BService(): B2BService {
  if (!_b2b) _b2b = new B2BService();
  return _b2b;
}

let _mcp: ContentMCPClient | null = null;

/** 真实熔断状态：dashboard「熔断数」只读访问点（CLOSED=0，OPEN=1）。 */
export function getMCPCircuitStatus(): { state: string; open: number } {
  if (!_mcp) {
    try {
      _mcp = new ContentMCPClient();
    } catch {
      return { state: "CLOSED", open: 0 };
    }
  }
  try {
    const stats = _mcp.getStats();
    return { state: stats.circuitState, open: stats.circuitState === "OPEN" ? 1 : 0 };
  } catch {
    return { state: "CLOSED", open: 0 };
  }
}

// ── 共享 zod 结构(workflow 步骤 outputSchema 复用)────────────

export const TrendKeywordSchema = z.object({
  word: z.string(),
  heat: z.number(),
  delta: z.number().nullable(),
  rank: z.number(),
  industry: z.string(),
  source: z.string(),
});

export const PlatformTrendsSchema = z.object({
  platform: z.string(),
  source: z.string(),
  degraded: z.boolean(),
  keywords: z.array(TrendKeywordSchema),
  warning: z.string().nullable(),
});

export type PlatformTrends = z.infer<typeof PlatformTrendsSchema>;

// ── 执行函数(工具 execute 与 workflow 步骤共用)───────────────

/** 拉取指定平台关键词趋势(IG 无词时由 B2BService 自动轮换每日品类词)。 */
export async function fetchPlatformTrends(input: {
  platform: TrendPlatform;
  industryId?: number;
}): Promise<PlatformTrends> {
  const r = await getB2BService().fetchKeywordTrends({
    platform: input.platform,
    industryId: input.industryId,
  });
  return {
    platform: r.platform,
    source: r.source,
    degraded: r.degraded,
    keywords: (r.keywords ?? []).map((k) => ({
      word: k.word, heat: k.heat, delta: k.delta, rank: k.rank, industry: k.industry, source: k.source,
    })),
    warning: r.warning ?? null,
  };
}

/** 长尾词(B2B 首页 SEO)。 */
export async function fetchLongtail(input: {
  industry: string;
  seedKeywords?: string[];
  limit?: number;
}) {
  const keywords = await getB2BService().generateLongtail({
    industry: input.industry,
    seedKeywords: input.seedKeywords ?? [],
    limit: input.limit,
  });
  return { industry: input.industry, keywords };
}

/** 阿里在售商品热词(经 MCP alibaba_product_list,聚合商品关键词词频)。 */
export async function fetchAlibabaHotwords(): Promise<{
  hotwords: string[];
  authorized: boolean;
  degraded: boolean;
}> {
  const r = await getB2BService().fetchProducts({});
  const freq = new Map<string, number>();
  for (const p of r.products) {
    for (const k of p.keywords ?? []) {
      const w = k.trim();
      if (!w) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  const hotwords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w);
  return { hotwords, authorized: r.authorized, degraded: r.degraded ?? false };
}

/** 营销生图(自举 OpenAI 兼容 images/generations,SiliconFlow Kolors)。 */
export async function generateMarketingImages(input: {
  prompt: string;
  aspectRatio?: string;
  numVariants?: number;
}) {
  const result = await selfhostGenerateImages({
    prompt: input.prompt,
    aspectRatio: input.aspectRatio || "1:1",
    numVariants: input.numVariants ? Math.min(4, Math.max(1, input.numVariants)) : 1,
  });
  return { images: result.images.map((img) => ({ index: img.index, url: img.url })) };
}

// ── MCP 工具 ─────────────────────────────────────────────────────

export const b2bTrendsTool = createTool({
  id: 'b2b_trends',
  description: '拉取跨境平台(TikTok/Instagram)关键词趋势热榜。IG 平台无关键词时自动按日轮换品类词池。自举 TikHub REST，无后端依赖。',
  inputSchema: z.object({
    platform: z.enum(['tiktok', 'instagram']).describe('目标平台'),
    industryId: z.number().optional().describe('行业 ID(可选)'),
  }),
  outputSchema: PlatformTrendsSchema,
  execute: async (input) => fetchPlatformTrends(input),
});

export const b2bLongtailTool = createTool({
  id: 'b2b_longtail',
  description: '基于行业与种子词生成长尾关键词(B2B SEO 用)。自举云 LLM 结构化生成，无后端依赖。',
  inputSchema: z.object({
    industry: z.string().describe('行业名,如 cross-border'),
    seedKeywords: z.array(z.string()).optional().describe('种子关键词'),
    limit: z.number().optional().describe('数量上限,默认 20'),
  }),
  outputSchema: z.object({
    industry: z.string(),
    keywords: z.array(z.object({
      word: z.string(),
      category: z.string(),
      searchIntent: z.string(),
    })),
  }),
  execute: async (input) => fetchLongtail(input),
});

export const imageGenerateTool = createTool({
  id: 'image_generate',
  description: 'AI 营销图片生成:按提示词生成产品/营销图。自举 OpenAI 兼容 images/generations(SiliconFlow)，无后端依赖。',
  inputSchema: z.object({
    prompt: z.string().describe('图片生成提示词'),
    aspectRatio: z.string().optional().describe('宽高比,如 1:1 / 3:4,默认 1:1'),
    numVariants: z.number().optional().describe('生成张数 1-4,默认 1'),
  }),
  outputSchema: z.object({
    images: z.array(z.object({ index: z.number(), url: z.string() })),
  }),
  execute: async (input) => generateMarketingImages(input),
});

/** MCP 工具清单(供未来 agent 挂载/遍历)。 */
export const mcpTools = {
  b2b_trends: b2bTrendsTool,
  b2b_longtail: b2bLongtailTool,
  image_generate: imageGenerateTool,
};
