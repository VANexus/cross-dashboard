/**
 * B端提示词工程 — L2 任务层（Task Prompts）
 *
 * 每个任务 = 任务指令 + 具体输入数据 + 偏好分支。
 * 由 index.ts 组装器与 L0 身份 / L1 知识 / L4 契约拼装后下发。
 */
import type { B2BPreference, KeywordTrend, LongtailKeyword } from "@/lib/shared/types";
import type { AlibabaProduct } from "@/lib/shared/types";

export const PREFERENCE_LABELS: Record<B2BPreference, string> = {
  social: "社媒投放（TikTok/Instagram 内容场）",
  alibaba: "阿里国际站（搜索场）",
  mix: "综合（国际站为主 + 社媒引流）",
};

/** 三偏好的差异化指令（Listing 任务内嵌） */
const PREFERENCE_DIRECTIVES: Record<B2BPreference, string> = {
  social: `本次偏好「社媒投放」：
- 标题可带趋势话题词/场景情绪词（如 TikTok viral、aesthetic），仍需遵守平台符号与极限词规则。
- 关键词侧重社媒搜索习惯（话题词、场景词、人群词），与标题差异化。
- image_prompt 面向社媒封面：竖版视觉钩子、氛围感构图、趋势风格标签，产品为绝对主角。`,
  alibaba: `本次偏好「阿里国际站」：
- 标题严格按「营销词+属性词+产品中心词+场景词（+认证词）」公式，核心词置于 with/for 之前。
- 关键词覆盖采购搜索意图（规格词、材质词、场景词），三个词互不重复、互补覆盖。
- image_prompt 面向国际站主图：白底/浅纯色底、产品居中占 2/3、无边框无水印，可另附 1-2 句场景图/细节图构图建议。`,
  mix: `本次偏好「综合」：
- 标题以国际站四维公式为骨架，允许在场景词位置融入 1 个社媒趋势词，兼顾两个流量场。
- 关键词一组覆盖采购意图、一组覆盖趋势/场景意图。
- image_prompt 给出两版建议：白底主图版（国际站）+ 氛围场景版（社媒）。`,
};

export interface ListingTaskInput {
  productId: string;
  subject: string;
  keyword?: string;
  productKeywords?: string[];
  preference: B2BPreference;
  /** 可选：当前趋势词上下文（推荐理由联动上架） */
  trendContext?: string;
}

export function listingTaskPrompt(input: ListingTaskInput): string {
  return `【任务：生成阿里国际站商品 Listing】

商品信息：
- product_id：${input.productId}
- 商品名：${input.subject}
- 主关键词：${input.keyword || input.productKeywords?.[0] || "（从商品名提炼）"}
- 商品既有标签：${(input.productKeywords ?? []).join("、") || "无"}
${input.trendContext ? `- 趋势上下文：${input.trendContext}` : ""}

${PREFERENCE_DIRECTIVES[input.preference]}

【生成要求】
1. title：英文，60–90 字符为佳（硬上限 128）；营销词+属性词+产品中心词+场景词；核心词在 with/for 之前；实词首字母大写。
2. keywords：恰好 3 个英文关键词，互不重复、与标题差异化互补，每个不含逗号/分号。
3. description：英文 ≥300 字符；结构 = 一句话价值主张 + 核心卖点分段 + markdown 参数表 + 服务承诺（OEM/ODM、样品、交期）；至少自然融入 5 个核心关键词（含标题词）。
4. image_prompt：英文，可直接用于文生图模型。
5. 内容必须与商品信息一致，禁止虚构认证（未提及 CE/FDA 就不要写）。`;
}

export interface RecommendTaskInput {
  preference: B2BPreference;
  products: AlibabaProduct[];
  trendKeywords: KeywordTrend[];
  longtailKeywords: LongtailKeyword[];
}

export function recommendTaskPrompt(input: RecommendTaskInput): string {
  const products = input.products
    .map((p) => `- product_id=${p.productId} | ${p.subject} | 标签：${p.keywords.join("/") || "无"} | 价格：${p.price || "未知"}`)
    .join("\n");
  const trends = input.trendKeywords
    .slice(0, 20)
    .map((k) => `- ${k.word}（热度 ${k.heat}${k.delta != null ? `，7日涨幅 ${k.delta > 0 ? "+" : ""}${k.delta}%` : ""}，排名 #${k.rank}）`)
    .join("\n");
  const longtails = input.longtailKeywords
    .slice(0, 20)
    .map((k) => `- ${k.word}（${k.category} / ${k.searchIntent}）`)
    .join("\n");

  return `【任务：今日推荐上架商品 TOP5（${PREFERENCE_LABELS[input.preference]}）】

从下方商品池中挑选最值得今日上架的 TOP5 商品，并给出带数据引用的推荐理由。

商品池：
${products || "（空）"}

趋势热榜：
${trends || "（无数据）"}

长尾词池：
${longtails || "（无数据）"}

【推荐逻辑】
1. 优先「双高」词（热度高+涨幅高）关联的商品；其次匹配飙升长尾词的搜索意图。
2. 商品标签/名称与趋势词的匹配度决定 score（0-100）。
3. 每条 reason 必须点名具体关键词及其数据（热度 TOP 榜位 / 涨幅百分比 / 长尾意图），格式示例：
   - 「makeup brush 关联词热度 TOP3（7日播放 8.2M），且 vanity case 长尾词 7 日涨幅 +64%」`;
}

export interface TrendDigestTaskInput {
  platform: string;
  keywords: KeywordTrend[];
  longtailKeywords: LongtailKeyword[];
}

export function trendDigestTaskPrompt(input: TrendDigestTaskInput): string {
  const kws = input.keywords
    .slice(0, 15)
    .map((k) => `- ${k.word}（热度 ${k.heat}${k.delta != null ? `，7日涨幅 ${k.delta > 0 ? "+" : ""}${k.delta}%` : ""}，排名 #${k.rank}）`)
    .join("\n");
  const longtails = input.longtailKeywords.slice(0, 10).map((k) => `- ${k.word}（${k.category}）`).join("\n");

  return `【任务：${input.platform} 趋势榜单归因分析】

今日榜单：
${kws || "（无数据）"}

关联长尾词：
${longtails || "（无数据）"}

按归因框架输出：识别 2-4 条最有商业信号的词（说明其属于平台热点/季节/事件/长尾衍生哪一类），并给出 2-3 条 B 端行动建议（推什么品、埋什么词）。`;
}
