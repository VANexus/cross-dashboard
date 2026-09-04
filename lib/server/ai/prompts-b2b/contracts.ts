/**
 * B端提示词工程 — L4 输出契约层（Output Contracts）
 *
 * 与 lib/shared/types.ts 的领域类型对齐：
 *   ListingDraftLLM   → B2BListingDraft（title/description/keywords/imagePrompt）
 *   RecommendLLM      → ListingRecommendation（productId/subject/score/reasons）
 *   TrendDigestLLM    → 每日摘要归因段
 *
 * 契约分两层：
 *   - 自然语言 JSON Schema 注入提示词（下方中文常量，约束生成行为）
 *   - zod schema 作为运行期校验（compile-time + runtime 双重保证，替代手写 normalize）
 * 解析链路：AI SDK 结构化输出 → extractJson 兜底 → ListingDraftSchema.safeParse 校验。
 */
import { z } from "zod";

export interface ListingDraftLLM {
  title: string;
  description: string;
  keywords: string[];
  image_prompt: string;
  warnings?: string[];
}

export interface RecommendLLM {
  recommendations: Array<{
    product_id: string;
    subject: string;
    score: number;
    reasons: string[];
  }>;
}

export interface TrendDigestLLM {
  headline: string;
  attribution: string[];
  actions: string[];
}

// ── zod schema（运行期校验，与 TS interface 对齐）──────────────────

export const listingDraftSchema = z
  .object({
    title: z.string().trim().min(1, "标题为空").max(128, "标题超过 128 字符"),
    description: z.string().trim().min(1, "描述为空"),
    keywords: z.array(z.string().trim().min(1)).max(3),
    image_prompt: z.string().trim().min(1, "主图提示词为空"),
    warnings: z.array(z.string()).optional(),
  })
  .transform((d) => ({
    title: d.title,
    description: d.description,
    keywords: d.keywords.slice(0, 3),
    image_prompt: d.image_prompt,
    warnings: d.warnings,
  }));

export const recommendSchema = z
  .object({
    recommendations: z
      .array(
        z.object({
          product_id: z.string().trim().min(1),
          subject: z.string().trim().default(""),
          score: z.number().finite().default(0),
          reasons: z.array(z.string()).default([]),
        }),
      )
      .min(1, "推荐结果为空"),
  })
  .transform((d): RecommendLLM => ({
    recommendations: d.recommendations.map((r) => ({
      product_id: r.product_id,
      subject: r.subject,
      score: r.score,
      reasons: r.reasons,
    })),
  }));

export const trendDigestSchema = z
  .object({
    headline: z.string().trim().min(1),
    attribution: z.array(z.string()).min(1, "归因不得为空"),
    actions: z.array(z.string()).min(0).default([]),
  })
  .transform((d) => ({
    headline: d.headline,
    attribution: d.attribution,
    actions: d.actions,
  }));

/** 长尾词展开（LONGTAIL_SYSTEM 输出）。 */
export const longtailSchema = z
  .object({
    keywords: z
      .array(
        z.object({
          word: z.string().trim().min(1),
          category: z.string().trim().default("通用"),
          search_intent: z.string().trim().default(""),
        }),
      )
      .min(1, "长尾词不得为空"),
  })
  .transform((d) => d.keywords);

export const LISTING_CONTRACT = `输出契约（严格遵守）：
只输出一个 JSON 对象，不得包含任何解释文字或代码围栏。结构如下：
{
  "title": "英文标题，≤128 字符，遵循四维公式与核心词位置规则",
  "description": "英文详情正文，≥300 字符，含参数表建议（以 markdown 表格呈现）与分段卖点",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "image_prompt": "英文主图生成提示词，描述白底/浅色底产品主图构图",
  "warnings": ["可选：生成过程中的合规提醒，无则省略该字段"]
}
硬性要求：keywords 必须恰好 3 个；每个关键词内不得出现逗号/分号；title 中不得出现极限词与装饰符号。`;

export const RECOMMEND_CONTRACT = `输出契约（严格遵守）：
只输出一个 JSON 对象，不得包含任何解释文字或代码围栏。结构如下：
{
  "recommendations": [
    {
      "product_id": "必须原样引用商品池中的 product_id",
      "subject": "商品名（可引用原文）",
      "score": 0-100 的匹配分,
      "reasons": ["推荐理由，每条必须引用具体趋势数据，如「makeup brush 关键词热度 TOP1（7日播放 12.4M）」「xx 长尾词 7 日涨幅 +86%」"]
    }
  ]
}
硬性要求：最多 5 条、按 score 降序；product_id 必须来自输入商品池，禁止虚构；reasons 每条不少于 1 个数据引用。`;

export const TREND_DIGEST_CONTRACT = `输出契约（严格遵守）：
只输出一个 JSON 对象，不得包含任何解释文字或代码围栏。结构如下：
{
  "headline": "一句话总结今日趋势（≤30 字，中文）",
  "attribution": ["归因判断，每条 1-2 句中文，需点名具体关键词与其热度/涨幅数据"],
  "actions": ["可执行建议，如「优先上架 X 关联商品，标题埋入 X 词」"]
}
硬性要求：attribution 2-4 条、actions 2-3 条；全部使用中文。`;
