/**
 * B端提示词工程 — 组装器（Prompt Assembler）
 *
 * 五层架构：
 *   L0 identity（角色人格） + L1 knowledge（领域知识）
 *   + L2 task（任务指令与输入） + L4 contract（输出契约） → system / prompt
 *   L3 validator（确定性校验）在生成后独立运行，构成「生成→校验→修复→复检」闭环。
 *
 * 用法：b2b.selfhost.ts 的 LLM 调用层取 buildListingPrompt / buildRecommendPrompt /
 *       buildTrendDigestPrompt 的结果直接喂给 generateText。
 */
import { LISTING_IDENTITY, RECOMMEND_IDENTITY, TREND_ANALYST_IDENTITY } from "./identity";
import { listingKnowledge, recommendKnowledge, trendAnalystKnowledge } from "./knowledge";
import { LISTING_CONTRACT, RECOMMEND_CONTRACT, TREND_DIGEST_CONTRACT } from "./contracts";
import {
  listingTaskPrompt, recommendTaskPrompt, trendDigestTaskPrompt,
  type ListingTaskInput, type RecommendTaskInput, type TrendDigestTaskInput,
} from "./tasks";

export interface AssembledPrompt {
  system: string;
  prompt: string;
}

/** Listing 生成：L0 + L1(规则+爆款) + L2(三偏好任务) + L4 契约 */
export function buildListingPrompt(input: ListingTaskInput): AssembledPrompt {
  return {
    system: `${LISTING_IDENTITY}\n\n${listingKnowledge()}\n\n${LISTING_CONTRACT}`,
    prompt: listingTaskPrompt(input),
  };
}

/** 商品推荐 TOP5：L0 + L1(归因+成长路径) + L2(推荐任务) + L4 契约 */
export function buildRecommendPrompt(input: RecommendTaskInput): AssembledPrompt {
  return {
    system: `${RECOMMEND_IDENTITY}\n\n${recommendKnowledge()}\n\n${RECOMMEND_CONTRACT}`,
    prompt: recommendTaskPrompt(input),
  };
}

/** 趋势归因（每日摘要）：L0 + L1(归因框架) + L2(归因任务) + L4 契约 */
export function buildTrendDigestPrompt(input: TrendDigestTaskInput): AssembledPrompt {
  return {
    system: `${TREND_ANALYST_IDENTITY}\n\n${trendAnalystKnowledge()}\n\n${TREND_DIGEST_CONTRACT}`,
    prompt: trendDigestTaskPrompt(input),
  };
}

export type { ListingTaskInput, RecommendTaskInput, TrendDigestTaskInput };
