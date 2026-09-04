/**
 * lib/server/services/b2b.selfhost.ts — B端运营 三能力自举 Provider 层
 *
 * 把原本走 flowmind MCP（b2b_keyword_trends / b2b_longtail_keywords / marketing_image_gen）
 * 的三个重技能，直接在 Next.js 全栈进程内实现：
 *
 *  1. b2b_trends   → TikHub REST（AI_TRENDS_API_BASE / AI_TRENDS_API_KEY，Bearer 鉴权）
 *  2. b2b_longtail → 云 LLM 结构化生成（复用 getAISDKModel，走 AI_LLM_* 网关）
 *  3. image_generate → OpenAI 兼容 images/generations（AI_IMAGE_API_URL / AI_IMAGE_API_KEY / AI_IMAGE_MODEL）
 *
 * 错误契约对齐 lib/mcp/client 的 ContentMCPError（category + retriable），
 * 使 B2BService 既有的降级/清缓存/CTA 语义零改动复用。
 * 密钥只从 env 读取（next.config.ts 启动时注入父目录 .env），不落库、不落前端。
 */
import { generateText } from "ai";
import type { LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getAIConfig, getAISDKModel } from "@/lib/server/ai";
import {
  buildListingPrompt, buildRecommendPrompt, buildTrendDigestPrompt,
  type ListingTaskInput, type RecommendTaskInput, type TrendDigestTaskInput,
} from "@/lib/server/ai/prompts-b2b";
import { validateListing, listingRepairPrompt } from "@/lib/server/ai/prompts-b2b/validator";
import {
  listingDraftSchema, recommendSchema, trendDigestSchema, longtailSchema,
  type ListingDraftLLM, type RecommendLLM, type TrendDigestLLM,
} from "@/lib/server/ai/prompts-b2b/contracts";
import type { z } from "zod";
import type { ContentImage, ListingRecommendation, LongtailKeyword } from "@/lib/shared/types";

// ── 错误契约（对齐 ContentMCPError）───────────────────────────────

export type SelfhostErrorCategory = "environment" | "skill" | "timeout" | "unknown";

export class SelfhostError extends Error {
  readonly category: SelfhostErrorCategory;
  readonly retriable: boolean;
  constructor(category: SelfhostErrorCategory, message: string) {
    super(message);
    this.name = "SelfhostError";
    this.category = category;
    this.retriable = category !== "skill";
  }
}

/** 从任意错误提取 category（兼容 ContentMCPError / SelfhostError / 普通 Error）。 */
export function failureCategoryOf(err: unknown): string | undefined {
  if (err instanceof SelfhostError) return err.category;
  if (err instanceof Error && "category" in err) {
    const c = (err as { category?: string }).category;
    if (c) return c;
  }
  return undefined;
}

export function retriableOf(err: unknown): boolean | undefined {
  if (err instanceof SelfhostError) return err.retriable;
  if (err instanceof Error && "retriable" in err) {
    const r = (err as { retriable?: boolean }).retriable;
    if (typeof r === "boolean") return r;
  }
  return undefined;
}

// ── 趋势行 ─────────────────────────────────────────────────────────

export interface TrendRow {
  word: string;
  heat: number;
  delta: number | null;
  rank: number;
  industry: string;
  source: string;
}

export interface TrendsResult {
  platform: string;
  source: string;
  degraded: boolean;
  keywords: TrendRow[];
  failure_category?: string;
  retriable?: boolean;
  warning?: string;
}

// ── TikHub 客户端 ─────────────────────────────────────────────────

const TIKHUB_DEFAULT_BASE = "https://api.tikhub.dev";
const PAGE_SIZE = 20;
const MAX_PAGES = 5;

interface TikHubEnvelope<T = unknown> {
  code?: number;
  message?: string;
  message_zh?: string;
  data?: T;
}

export class TikHubClient {
  private readonly base: string;
  private readonly key: string;

  constructor() {
    this.base = (process.env.AI_TRENDS_API_BASE ?? TIKHUB_DEFAULT_BASE).replace(/\/+$/, "");
    this.key = process.env.AI_TRENDS_API_KEY?.trim() ?? "";
  }

  private hasKey(): boolean {
    return this.key.length > 0;
  }

  /** 统一请求：Bearer + JSON；失败按 HTTP/业务码映射为 SelfhostError。 */
  private async request<T = unknown>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    if (!this.hasKey()) {
      throw new SelfhostError(
        "environment",
        "未配置趋势接口密钥 AI_TRENDS_API_KEY（父目录 .env 已预置 TikHub key，请确认部署时注入）。",
      );
    }
    const url = `${this.base}${path}`;
    let resp: Response;
    try {
      resp = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
          ...(method === "GET" ? {} : {}),
        },
        body: method === "POST" && body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "网络错误";
      throw new SelfhostError("timeout", `趋势接口网络异常：${reason}`);
    }

    if (resp.status === 401 || resp.status === 403) {
      throw new SelfhostError("environment", `趋势接口鉴权失败（HTTP ${resp.status}），请检查 AI_TRENDS_API_KEY。`);
    }
    if (resp.status === 402 || resp.status === 429) {
      throw new SelfhostError("environment", `趋势接口额度不足或触发限流（HTTP ${resp.status}），请稍后重试或充值。`);
    }
    if (resp.status >= 500) {
      throw new SelfhostError("timeout", `趋势服务暂不可用（HTTP ${resp.status}）。`);
    }

    let raw: TikHubEnvelope<T>;
    try {
      raw = (await resp.json()) as TikHubEnvelope<T>;
    } catch {
      throw new SelfhostError("unknown", `趋势接口返回非 JSON（HTTP ${resp.status}）。`);
    }

    // 业务信封：code=200 视为成功；否则带 message 抛出
    const code = raw.code ?? 200;
    if (code !== 200 && code !== 0) {
      const msg = raw.message_zh || raw.message || `业务错误码 ${code}`;
      throw new SelfhostError("unknown", `趋势接口业务错误：${msg}`);
    }
    return raw.data as T;
  }

  /** 7 天曲线首尾涨幅百分比，与后端 _cc_scraper.curve_delta 对齐。 */
  private static curveDelta(curve: Array<{ timestamp?: string | number; value?: number }> | undefined): number | null {
    if (!Array.isArray(curve) || curve.length < 2) return null;
    const values = curve
      .map((p) => (typeof p === "number" ? p : p?.value))
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (values.length < 2) return null;
    const first = values[0];
    if (first === 0) return null;
    return Math.round(((values[values.length - 1] - first) / first) * 100);
  }

  /** TT 热榜：分页聚合到 limit，rank 连续化（对齐 _tikhub_trends.py）。 */
  async fetchTiktokTrends(industryId?: number, limit = 30): Promise<TrendRow[]> {
    const rows: TrendRow[] = [];
    const pages = Math.max(1, Math.min(Math.ceil(limit / PAGE_SIZE), MAX_PAGES));
    for (let page = 1; page <= pages && rows.length < limit; page++) {
      const data = await this.request<{ items?: Array<Record<string, unknown>> }>(
        "POST",
        "/api/v1/tiktok/ads/get_trends_hashtag_list",
        {
          time_range: 7,
          country_code: "US",
          page,
          limit: PAGE_SIZE,
          ...(industryId ? { industry_id: industryId } : {}),
        },
      );
      const items = data?.items ?? [];
      for (const it of items) {
        if (rows.length >= limit) break;
        const name = String(it.hashtagName ?? "").replace(/^#/, "").trim();
        if (!name) continue;
        const heat = Number(it.vv ?? 0);
        if (!Number.isFinite(heat)) continue;
        rows.push({
          word: name,
          heat,
          delta: TikHubClient.curveDelta(it.popularityCurve as Array<{ timestamp?: string | number; value?: number }> | undefined),
          rank: 0, // 下面对齐
          industry: Array.isArray(it.industryIDs) ? String(it.industryIDs[0] ?? "") : "",
          source: "tikhub",
        });
      }
      if (items.length < PAGE_SIZE) break;
    }
    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  }

  /** IG 话题搜索（必需关键词）：按 media_count 降序、rank 重排（对齐 _tikhub_instagram.py）。 */
  async fetchInstagramTrends(keyword: string, limit = 30): Promise<TrendRow[]> {
    const kw = keyword.replace(/^#/, "").trim();
    if (!kw) {
      throw new SelfhostError("skill", "Instagram 话题趋势必需关键词（IG 无匿名全站榜单，请提供品类词）。");
    }
    const data = await this.request<{ data?: { items?: Array<Record<string, unknown>> } }>(
      "GET",
      `/api/v1/instagram/v2/search_hashtags?keyword=${encodeURIComponent(kw)}`,
    );
    const items = data?.data?.items ?? [];
    const parsed: TrendRow[] = [];
    for (const it of items) {
      const name = String(it.name ?? "").trim();
      if (!name) continue;
      const heat = Number(it.media_count ?? 0);
      if (!Number.isFinite(heat)) continue;
      parsed.push({ word: name, heat, delta: null, rank: 0, industry: "", source: "tikhub-instagram" });
    }
    parsed.sort((a, b) => b.heat - a.heat);
    parsed.forEach((r, i) => { r.rank = i + 1; });
    return parsed.slice(0, limit);
  }

  /** 平台趋势统一入口：IG 无词时抛 skill 错误由上层轮换词池。 */
  async fetchTrends(input: {
    platform: "tiktok" | "instagram";
    industryId?: number;
    keyword?: string;
    limit?: number;
  }): Promise<TrendsResult> {
    const limit = input.limit ?? 30;
    try {
      const keywords =
        input.platform === "instagram"
          ? await this.fetchInstagramTrends(input.keyword ?? "", limit)
          : await this.fetchTiktokTrends(input.industryId, limit);
      if (keywords.length === 0) {
        return {
          platform: input.platform,
          source: "tikhub",
          degraded: true,
          keywords: [],
          retriable: false,
          warning: "趋势接口返回空数据（该时段无上榜话题），请稍后刷新或更换品类词。",
        };
      }
      return {
        platform: input.platform,
        source: input.platform === "instagram" ? "tikhub-instagram" : "tikhub",
        degraded: false,
        keywords,
      };
    } catch (err) {
      if (err instanceof SelfhostError) {
        return {
          platform: input.platform,
          source: "tikhub_error",
          degraded: true,
          keywords: [],
          failure_category: err.category,
          retriable: err.retriable,
          warning: err.message,
        };
      }
      throw err;
    }
  }
}

// 单例（与 ContentMCPClient 连接池同级）
let _tikHub: TikHubClient | null = null;
export function getTikHubClient(): TikHubClient {
  if (!_tikHub) _tikHub = new TikHubClient();
  return _tikHub;
}

// ── 云 LLM 结构化生成基座（模型回退链 + 稳健 JSON 抽取）────────────

const LONGTAIL_SYSTEM =
  "你是跨境电商关键词研究专家，精通 B2B 外贸行业长尾关键词挖掘。\n" +
  "基于用户给出的行业与热门词，扩展同行业长尾关键词并按小类分组。\n" +
  "硬性要求：\n" +
  "1) 长尾词要足够具体（2-5 个词组成），符合海外采购/搜索习惯；\n" +
  "2) 每个词给 category（小类，如 包装/功效/场景）与 search_intent（搜索意图，如 informational/commercial/transactional）；\n" +
  '3) 只输出 JSON 对象：{"keywords": [{"word": "...", "category": "...", "search_intent": "..."}]}。';

/** 可靠结构化模型（结构化长输出更稳定）。模型名不写死：
 *  prod 优先读 ai_config 的 model（前端「设置」页可改），dev 用 AI_LLM_STRUCTURED_MODEL env，
 *  最后回退 AI_LLM_MODEL env。 */
async function createFallbackModel(): Promise<LanguageModel> {
  const apiKey = process.env.AI_LLM_API_KEY?.trim();
  const baseUrl = process.env.AI_LLM_BASE_URL?.trim();
  if (!apiKey || !baseUrl) throw new SelfhostError("environment", "模型网关未配置。");
  // prod：前端设置页改 model 写入 ai_config，此处优先采纳；dev 用 AI_LLM_STRUCTURED_MODEL/AI_LLM_MODEL env。
  let configured: string | undefined;
  try {
    const cfg = await getAIConfig();
    configured = cfg.model?.trim();
  } catch {
    /* 读不到配置则用 env */
  }
  const model = configured || process.env.AI_LLM_STRUCTURED_MODEL?.trim() || process.env.AI_LLM_MODEL?.trim();
  if (!model) throw new SelfhostError("environment", "结构化模型未配置（前端设置 / AI_LLM_STRUCTURED_MODEL / AI_LLM_MODEL）。");
  const base = baseUrl.replace(/\/+$/, "");
  const openai = createOpenAI({
    apiKey,
    baseURL: base.endsWith("/v1") ? base : `${base}/v1`,
  });
  return openai.chat(model);
}

/**
 * 「可靠结构化模型 + 配置模型」链：结构化长输出优先用 AI_LLM_STRUCTURED_MODEL
 * （dev 环境变量 / prod 前端可配），每模型至多 2 次，取首个通过 zod schema 校验的结果。
 * 输出先走 extractJson 稳健抠取，再由 schema.safeParse 做运行时校验（框架级契约，
 * 替代散装手写 normalize）。
 */
async function generateStructuredJson<T>(
  system: string,
  prompt: string,
  schema: import("zod").ZodType<T>,
  what: string,
  maxOutputTokens = 4096,
): Promise<T> {
  const models: LanguageModel[] = [];
  // 结构化模型优先（稳定出 JSON）；配置模型兜底。
  try {
    models.push(await createFallbackModel());
  } catch {
    /* 结构化模型不可用时用配置模型 */
  }
  try {
    models.push(await getAISDKModel());
  } catch {
    /* 配置模型不可用则仅用已入队的模型 */
  }
  if (models.length === 0) {
    throw new SelfhostError("environment", `模型网关未配置，无法生成${what}。`);
  }

  let lastErr: unknown = null;
  const callTimeoutMs = 45_000; // 慢网关防护：单次 LLM 调用最多 45s，避免 90s+ 双模型叠加
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await generateText({
          model,
          system,
          prompt,
          maxOutputTokens,
          abortSignal: AbortSignal.timeout(callTimeoutMs),
        });
        // 空/过短 content：立即短路，不把它当"无效 JSON"再空耗一次慢重试
        const text = (res.text ?? "").trim();
        if (text.length < 1) {
          lastErr = new SelfhostError("skill", `模型返回了空内容${what}，请重试。`);
          continue;
        }
        const parsed = extractJson(text);
        const checked = parsed == null ? null : schema.safeParse(parsed);
        if (checked && checked.success) return checked.data;
        lastErr = new SelfhostError("skill", `模型未返回有效的${what} JSON，请重试。`);
      } catch (err) {
        const aborted = err instanceof Error && (err.name === "TimeoutError" || err.message.toLowerCase().includes("timeout"));
        if (aborted) {
          lastErr = new SelfhostError("timeout", `${what}生成超时（${callTimeoutMs / 1000}s），模型网关响应过慢。`);
          continue;
        }
        lastErr = err;
      }
    }
  }
  throw lastErr instanceof Error
    ? new SelfhostError("unknown", `${what}生成失败：${lastErr.message}`)
    : new SelfhostError("unknown", `${what}生成失败。`);
}

/** 从模型输出里稳健地抠出 JSON 对象（容忍代码围栏 / 前后缀噪声）。 */
function extractJson<T = Record<string, unknown>>(text: string): T | null {
  if (!text) return null;
  let s = text.trim();
  // 剥 ```json ... ``` 围栏
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) s = fence[1].trim();
  // 找第一个 { 到最后一个 }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  s = s.slice(start, end + 1);
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export async function generateLongtail(input: {
  industry: string;
  seedKeywords?: string[];
  limit?: number;
}): Promise<LongtailKeyword[]> {
  const limit = Math.max(1, Math.min(50, input.limit ?? 20));
  const seeds = (input.seedKeywords ?? []).filter(Boolean).join("、") || "无";
  const prompt =
    `行业：${input.industry}\n来源热门词：${seeds}\n\n` +
    `请生成 ${limit} 个该行业的长尾关键词，按小类分组。只输出 JSON 对象。`;

  type LongtailOut = z.infer<typeof longtailSchema>;
  const json = await generateStructuredJson<LongtailOut>(
    LONGTAIL_SYSTEM,
    prompt,
    longtailSchema,
    "长尾词",
  );

  const out: LongtailKeyword[] = [];
  for (const it of json) {
    const word = String(it?.word ?? "").trim();
    if (!word) continue;
    out.push({
      word,
      category: String(it?.category ?? "通用").trim() || "通用",
      searchIntent: String(it?.search_intent ?? "").trim(),
    });
    if (out.length >= limit) break;
  }
  if (out.length === 0) throw new SelfhostError("skill", "模型未返回有效的长尾词 JSON，请重试。");
  return out;
}

// ── B2B Listing 生成（五层提示词 + 校验修复闭环）────────────────────

export interface SelfhostListingResult {
  title: string;
  description: string;
  keywords: string[];
  imagePrompt: string;
  /** 校验/修复后仍未消除或需运营确认的问题（含 warning 级） */
  warnings: string[];
  /** 实际执行的 LLM 修复轮数 */
  repairRounds: number;
}

const FIELD_LABELS: Record<string, string> = {
  title: "标题", keywords: "关键词", description: "详情描述", image_prompt: "主图提示词",
};

/**
 * Listing 生成主链路：生成 → L3 确定性校验 → error 级问题 LLM 修复（≤2 轮）→ 复检。
 * 修复只会采纳「error 数减少」的版本；最终仍存的 error/warning 以 warnings 透出给运营。
 */
export async function generateListingDraft(input: ListingTaskInput): Promise<SelfhostListingResult> {
  const assembled = buildListingPrompt(input);
  const mainKeyword = input.keyword || input.productKeywords?.[0] || "";

  let draft = await generateStructuredJson<ListingDraftLLM>(
    assembled.system, assembled.prompt, listingDraftSchema, "Listing",
  );
  let issues = validateListing(draft, mainKeyword);

  let repairRounds = 0;
  while (issues.some((i) => i.severity === "error") && repairRounds < 2) {
    repairRounds += 1;
    const repaired = await generateStructuredJson<ListingDraftLLM>(
      assembled.system, listingRepairPrompt(draft, issues), listingDraftSchema, "Listing 修复",
    );
    const nextIssues = validateListing(repaired, mainKeyword);
    // 只采纳比当前版本 error 更少的修复结果，防止越修越坏
    if (nextIssues.filter((i) => i.severity === "error").length < issues.filter((i) => i.severity === "error").length) {
      draft = repaired;
      issues = nextIssues;
    } else {
      break;
    }
  }

  const llmWarnings = draft.warnings ?? [];
  const ruleWarnings = issues.map((i) => `【${FIELD_LABELS[i.field] ?? i.field}】${i.message}`);
  return {
    title: draft.title,
    description: draft.description,
    keywords: draft.keywords.slice(0, 3),
    imagePrompt: draft.image_prompt,
    warnings: [...llmWarnings, ...ruleWarnings],
    repairRounds,
  };
}

// ── 商品推荐 TOP5（趋势数据归因理由）──────────────────────────────

/** RAG 商品检索：运营商品池已向量化为 Milvus product zone，先取与趋势词最相关的 top-N。 */
export async function topProductsForTrends(
  products: import("@/lib/shared/types").AlibabaProduct[],
  trendKeywords: Array<{ word: string }>,
): Promise<import("@/lib/shared/types").AlibabaProduct[]> {
  const kb = await import("@/lib/server/db/b2b-kb");
  const query = trendKeywords.map((k) => k.word).filter(Boolean).join(" ");
  if (!query) return products.slice(0, 12);

  // 检索失败（Milvus 未就绪等）→ 退化全量前 12（保底可推荐），不阻塞主链路
  let hits: Array<{ id: string; meta: Record<string, string> }>;
  try {
    hits = await kb.searchB2BKb(query, { zone: "product", limit: 12 });
  } catch {
    return products.slice(0, 12);
  }
  if (hits.length === 0) return products.slice(0, 12);

  const byId = new Map(products.map((p) => [p.productId, p]));
  const ranked = hits.map((h) => byId.get(h.meta?.productId ?? h.id)).filter((p): p is import("@/lib/shared/types").AlibabaProduct => Boolean(p));
  // 兜底：命中不足 12 则补未命中商品
  for (const p of products) {
    if (ranked.length >= 12) break;
    if (!ranked.some((r) => r.productId === p.productId)) ranked.push(p);
  }
  return ranked;
}

export async function recommendProducts(input: RecommendTaskInput): Promise<ListingRecommendation[]> {
  const assembled = buildRecommendPrompt(input);
  const json = await generateStructuredJson<RecommendLLM>(
    assembled.system, assembled.prompt, recommendSchema, "商品推荐",
  );

  const knownIds = new Set(input.products.map((p) => p.productId));
  const out: ListingRecommendation[] = [];
  for (const r of json.recommendations) {
    const productId = r.product_id.trim();
    if (!knownIds.has(productId)) continue; // 禁止虚构商品
    out.push({
      productId,
      subject: r.subject.trim(),
      score: Math.max(0, Math.min(100, r.score)),
      reasons: r.reasons.filter(Boolean),
    });
    if (out.length >= 5) break;
  }
  out.sort((a, b) => b.score - a.score);
  if (out.length === 0) throw new SelfhostError("skill", "模型未返回有效的商品推荐结果，请重试。");
  return out;
}

// ── 趋势归因（每日摘要增强）──────────────────────────────────────

export async function analyzeTrendDigest(input: TrendDigestTaskInput): Promise<TrendDigestLLM> {
  const assembled = buildTrendDigestPrompt(input);
  return await generateStructuredJson<TrendDigestLLM>(
    assembled.system, assembled.prompt, trendDigestSchema, "趋势归因",
  );
}

// ── 营销生图：OpenAI 兼容 images/generations（SiliconFlow 已验证）───

const IMAGE_DEFAULT_MODEL = "Kwai-Kolors/Kolors";

export async function generateImages(input: {
  prompt: string;
  aspectRatio?: string;
  numVariants?: number;
  negativePrompt?: string;
}): Promise<{ images: ContentImage[] }> {
  const prompt = input.prompt?.trim();
  if (!prompt) {
    throw new SelfhostError("skill", "生图提示词不能为空。");
  }
  const apiUrl = process.env.AI_IMAGE_API_URL?.trim();
  const apiKey = process.env.AI_IMAGE_API_KEY?.trim();
  if (!apiKey || !apiUrl) {
    throw new SelfhostError(
      "environment",
      "未配置生图接口 AI_IMAGE_API_KEY / AI_IMAGE_API_URL（父目录 .env 已预置 SiliconFlow 生图端点）。",
    );
  }

  const n = Math.max(1, Math.min(4, input.numVariants ?? 1));
  const aspect = normalizeAspect(input.aspectRatio || "1:1");
  const size = aspectToSize(aspect);

  // OpenAI 协议不支持独立 negative_prompt —— 合并到 prompt 末尾（与后端 AllInApiBackend 一致）
  let finalPrompt = prompt;
  const neg = input.negativePrompt?.trim();
  if (neg) finalPrompt = `${prompt}\n\nAvoid: ${neg}`;

  let resp: Response;
  try {
    resp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.AI_IMAGE_MODEL?.trim() || IMAGE_DEFAULT_MODEL,
        prompt: finalPrompt,
        n,
        size,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "网络错误";
    throw new SelfhostError("timeout", `生图接口网络异常：${reason}`);
  }

  if (resp.status === 401 || resp.status === 403) {
    throw new SelfhostError("environment", `生图接口鉴权失败（HTTP ${resp.status}），请检查 AI_IMAGE_API_KEY。`);
  }
  if (resp.status === 402 || resp.status === 429) {
    throw new SelfhostError("environment", `生图接口额度不足或触发限流（HTTP ${resp.status}），请稍后重试。`);
  }
  if (resp.status >= 500) {
    throw new SelfhostError("timeout", `生图服务暂不可用（HTTP ${resp.status}）。`);
  }

  let body: { data?: Array<{ url?: string; b64_json?: string }>; error?: { message?: string } };
  try {
    body = (await resp.json()) as typeof body;
  } catch {
    throw new SelfhostError("unknown", `生图接口返回非 JSON（HTTP ${resp.status}）。`);
  }
  if (resp.status >= 400) {
    throw new SelfhostError("unknown", `生图接口错误：${body?.error?.message ?? `HTTP ${resp.status}`}`);
  }

  const items = (body.data ?? []).slice(0, n);
  if (items.length === 0) {
    throw new SelfhostError("unknown", "生图接口返回空结果，请重试。");
  }
  const images: ContentImage[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const url = item.url ?? (item.b64_json ? `data:image/png;base64,${item.b64_json}` : "");
    if (!url) continue;
    images.push({ index: i + 1, url });
  }
  if (images.length === 0) {
    throw new SelfhostError("unknown", "生图接口未返回可用图片 URL，请重试。");
  }
  return { images };
}

/** 规范化宽高比（非法回退 1:1）。 */
function normalizeAspect(aspect: string): string {
  const m = aspect.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return "1:1";
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!a || !b || a / b > 4 || b / a > 4) return "1:1";
  return `${a}:${b}`;
}

/** 宽高比 → 像素尺寸（与后端 _dimensions 同思路：以长边 1024 为基准）。 */
function aspectToSize(aspect: string): string {
  const [a, b] = aspect.split(":").map(Number);
  if (!a || !b) return "1024x1024";
  const base = 1024;
  if (b >= a) {
    return `${Math.max(1, Math.round((base * a) / b))}x${base}`;
  }
  return `${base}x${Math.max(1, Math.round((base * b) / a))}`;
}
