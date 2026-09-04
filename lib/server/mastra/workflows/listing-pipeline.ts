/**
 * lib/mastra/workflows/listing-pipeline.ts
 *
 * Listing 流水线 workflow:
 *   生成 Listing(本地工具) → **suspend 等待人工确认**(resume schema: { confirmed })
 *   → AI 作图(本地工具) → 输出 { listing, images }。
 *
 * suspend 到达时 run route 发 plan_step { status: 'confirm', runId },前端确认后
 * POST resume { runId, stepId, confirmed } → run.resume({ resumeData, step }) 续跑。
 */
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { runImagingGenerate, runListingGenerate } from '../tools/local-tools';

// ── Schema ───────────────────────────────────────────────────────

const ListingShape = z.object({
  id: z.string(),
  title: z.string(),
  bullets: z.array(z.string()),
  description: z.string(),
  searchTerms: z.array(z.string()),
  seoScore: z.number(),
  estimatedCtr: z.string(),
});

const ImageShape = z.object({
  url: z.string(),
  revisedPrompt: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
});

/** 中间步骤统一传递 PipelineCtx(全可选字段),链式 schema 类型约束天然满足。 */
const PipelineCtx = z.object({
  keyword: z.string().optional(),
  category: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  listing: ListingShape.nullable().optional(),
  confirmed: z.boolean().optional(),
});

const PipelineOutput = z.object({
  listing: ListingShape,
  images: z.array(ImageShape),
});

// ── Steps ────────────────────────────────────────────────────────

const listingGenerateStep = createStep({
  id: 'listing-generate',
  description: '基于关键词生成 Listing 草稿(本地工具 listing_generate)',
  inputSchema: PipelineCtx,
  outputSchema: PipelineCtx,
  execute: async ({ inputData }) => {
    const keyword = inputData.keyword?.trim();
    if (!keyword) throw new Error('缺少 keyword:请提供产品核心关键词');
    const listing = await runListingGenerate({
      keyword,
      category: inputData.category ?? undefined,
      language: inputData.language ?? undefined,
    });
    return { ...inputData, listing };
  },
});

const humanConfirmStep = createStep({
  id: 'human-confirm',
  description: '人工确认 Listing(suspend 等待用户确认后继续)',
  inputSchema: PipelineCtx,
  outputSchema: PipelineCtx,
  suspendSchema: z.object({
    title: z.string().describe('Listing 标题'),
    summary: z.string().describe('草稿摘要'),
  }),
  resumeSchema: z.object({
    confirmed: z.boolean().describe('用户是否确认继续'),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    // resume 重入:confirmed=true → 继续生图;confirmed=false → 用户终止流程
    if (resumeData?.confirmed === true) {
      return { ...inputData, confirmed: true };
    }
    if (resumeData) {
      throw new Error('用户终止了 Listing 流水线');
    }
    // 首次执行:挂起等待人工确认(resume 时重新进入 execute)
    const listing = inputData.listing;
    await suspend({
      title: listing?.title ?? 'Listing 草稿',
      summary: `${listing?.bullets.length ?? 0} 条卖点 · SEO 评分 ${listing?.seoScore ?? 0} · ${listing?.searchTerms.length ?? 0} 个搜索词`,
    });
    return inputData;
  },
});

const imagingGenerateStep = createStep({
  id: 'imaging-generate',
  description: '基于 Listing 标题生成产品主图(本地工具 imaging_generate)',
  inputSchema: PipelineCtx,
  outputSchema: PipelineOutput,
  execute: async ({ inputData }) => {
    const listing = inputData.listing;
    if (!listing) throw new Error('缺少 Listing 草稿:请先完成生成与确认步骤');
    const images = await runImagingGenerate({
      prompt: listing.title,
      type: 'main',
      count: 4,
    });
    return { listing, images };
  },
});

// ── Workflow ─────────────────────────────────────────────────────

export const listingPipelineWorkflow = createWorkflow({
  id: 'listing-pipeline',
  description: 'Listing 流水线:生成 → 人工确认(suspend/resume) → AI 作图',
  inputSchema: PipelineCtx,
  outputSchema: PipelineOutput,
})
  .then(listingGenerateStep)
  .then(humanConfirmStep)
  .then(imagingGenerateStep)
  .commit();
