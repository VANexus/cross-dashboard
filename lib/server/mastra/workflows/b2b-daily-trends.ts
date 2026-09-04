/**
 * lib/mastra/workflows/b2b-daily-trends.ts
 *
 * 每日趋势榜单 workflow:
 *   TikTok 趋势(MCP) → IG 话题趋势(MCP,无词时按日轮换品类词池) → 阿里在售热词(MCP)
 *   → 确定性聚合生成摘要与 Top 推荐 → 结构化输出(card: trends-summary)。
 *
 * 中间步骤统一传递 TrendsCtx(全可选字段),链式 then() 的 schema 类型约束天然满足;
 * 最终步骤输出强类型 SummaryOutput 作为 workflow 输出。
 */
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import {
  PlatformTrendsSchema,
  TrendKeywordSchema,
  fetchAlibabaHotwords,
  fetchPlatformTrends,
} from '../tools/mcp-tools';

// ── Schema ───────────────────────────────────────────────────────

const TrendsCtx = z.object({
  industry: z.string().optional(),
  industryId: z.number().nullable().optional(),
  tiktok: PlatformTrendsSchema.optional(),
  instagram: PlatformTrendsSchema.optional(),
  hotwords: z.array(z.string()).optional(),
  authorized: z.boolean().optional(),
  hotwordsDegraded: z.boolean().optional(),
});

const SummaryOutput = z.object({
  date: z.string(),
  industry: z.string(),
  sections: z.array(z.object({
    platform: z.string(),
    label: z.string(),
    source: z.string(),
    degraded: z.boolean(),
    keywords: z.array(z.object({ word: z.string(), heat: z.number(), rank: z.number() })),
  })),
  alibabaHotwords: z.array(z.string()),
  topPicks: z.array(z.object({
    word: z.string(),
    platform: z.string(),
    heat: z.number(),
    rank: z.number(),
    reason: z.string(),
  })),
  summary: z.string(),
});

// ── Steps ────────────────────────────────────────────────────────

const tiktokTrendsStep = createStep({
  id: 'tiktok-trends',
  description: '拉取 TikTok 关键词趋势热榜(flowmind MCP)',
  inputSchema: TrendsCtx,
  outputSchema: TrendsCtx,
  execute: async ({ inputData }) => {
    const tiktok = await fetchPlatformTrends({
      platform: 'tiktok',
      industryId: inputData.industryId ?? undefined,
    });
    return {
      ...inputData,
      industry: inputData.industry ?? 'cross-border',
      industryId: inputData.industryId ?? null,
      tiktok,
    };
  },
});

const igTrendsStep = createStep({
  id: 'ig-trends',
  description: '拉取 Instagram 话题趋势(无词时按日轮换品类词池)',
  inputSchema: TrendsCtx,
  outputSchema: TrendsCtx,
  execute: async ({ inputData }) => {
    const instagram = await fetchPlatformTrends({
      platform: 'instagram',
      industryId: inputData.industryId ?? undefined,
    });
    return { ...inputData, instagram };
  },
});

const alibabaHotwordsStep = createStep({
  id: 'alibaba-hotwords',
  description: '聚合阿里国际站在售商品关键词热词',
  inputSchema: TrendsCtx,
  outputSchema: TrendsCtx,
  execute: async ({ inputData }) => {
    const r = await fetchAlibabaHotwords();
    return { ...inputData, hotwords: r.hotwords, authorized: r.authorized, hotwordsDegraded: r.degraded };
  },
});

const summarizeStep = createStep({
  id: 'summarize',
  description: '聚合三路数据生成今日榜单摘要与 Top 推荐',
  inputSchema: TrendsCtx,
  outputSchema: SummaryOutput,
  execute: async ({ inputData, getStepResult }) => {
    const tiktok = getStepResult(tiktokTrendsStep).tiktok;
    const instagram = getStepResult(igTrendsStep).instagram;
    const hotCtx = getStepResult(alibabaHotwordsStep);

    const sections = [
      {
        platform: 'tiktok', label: 'TikTok 热词榜', source: tiktok?.source ?? '-',
        degraded: tiktok?.degraded ?? true,
        keywords: (tiktok?.keywords ?? []).slice(0, 10)
          .map((k: z.infer<typeof TrendKeywordSchema>) => ({ word: k.word, heat: k.heat, rank: k.rank })),
      },
      {
        platform: 'instagram', label: 'IG 话题榜', source: instagram?.source ?? '-',
        degraded: instagram?.degraded ?? true,
        keywords: (instagram?.keywords ?? []).slice(0, 10)
          .map((k: z.infer<typeof TrendKeywordSchema>) => ({ word: k.word, heat: k.heat, rank: k.rank })),
      },
    ];

    // 合并双平台热度做跨平台 Top 推荐
    const merged = [
      ...(tiktok?.keywords ?? []).map((k) => ({ ...k, platform: 'tiktok' })),
      ...(instagram?.keywords ?? []).map((k) => ({ ...k, platform: 'instagram' })),
    ];
    const topPicks = merged
      .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0) || b.heat - a.heat)
      .slice(0, 5)
      .map((k) => ({
        word: k.word,
        platform: k.platform,
        heat: k.heat,
        rank: k.rank,
        reason: k.delta != null && k.delta > 0
          ? `${k.platform} 端热度上升 ${k.delta}，当前排名第 ${k.rank}`
          : `${k.platform} 端热度 ${k.heat}，排名第 ${k.rank}`,
      }));

    const hotwords = hotCtx.hotwords ?? [];
    const parts = [
      `TikTok Top${sections[0].keywords.length}: ${sections[0].keywords.map((k) => k.word).join('、') || '暂无数据'}`,
      `IG Top${sections[1].keywords.length}: ${sections[1].keywords.map((k) => k.word).join('、') || '暂无数据'}`,
      `阿里在售热词: ${hotwords.slice(0, 8).join('、') || '暂无数据'}`,
    ];
    const summary = `今日趋势摘要 — ${parts.join('；')}。${topPicks.length ? `重点关注「${topPicks[0].word}」(${topPicks[0].reason})。` : ''}`;

    return {
      date: new Date().toISOString().slice(0, 10),
      industry: inputData.industry ?? 'cross-border',
      sections,
      alibabaHotwords: hotwords,
      topPicks,
      summary,
    };
  },
});

// ── Workflow ─────────────────────────────────────────────────────

export const b2bDailyTrendsWorkflow = createWorkflow({
  id: 'b2b-daily-trends',
  description: '每日跨境趋势榜单:TikTok/IG 趋势 + 阿里热词 → 结构化榜单与推荐',
  inputSchema: TrendsCtx,
  outputSchema: SummaryOutput,
})
  .then(tiktokTrendsStep)
  .then(igTrendsStep)
  .then(alibabaHotwordsStep)
  .then(summarizeStep)
  .commit();
