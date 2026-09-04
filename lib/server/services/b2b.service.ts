/**
 * FlowMind — B端运营工作台 Service
 *
 * 业务编排层（已全面自举：趋势/长尾/生图 TikHub+REST，推送/每日摘要/图反向 prompt 直连 Next.js）。
 * 阿里域（alibaba_product_list 等）亦已自举：TOP 协议 HMAC-MD5 签名直连阿里开放 API，
 * 凭证走 ALIBABA_APP_KEY/APP_SECRET/SESSION（工作区 .env），无凭证时降级为设置引导。
 */
import { createHmac } from "node:crypto";
import { ContentMCPClient, ContentMCPError } from "@/lib/mcp/client";
import { generateText } from "ai";
import { getAISDKModel } from "@/lib/server/ai";
import {
  analyzeTrendDigest as selfhostAnalyzeTrendDigest,
  generateImages as selfhostGenerateImages,
  generateListingDraft as selfhostGenerateListingDraft,
  generateLongtail as selfhostGenerateLongtail,
  getTikHubClient,
  recommendProducts as selfhostRecommendProducts,
  topProductsForTrends as selfhostTopProductsForTrends,
  failureCategoryOf,
  retriableOf,
  SelfhostError,
} from "@/lib/server/services/b2b.selfhost";
import { BUILTIN_IMAGE_SKILL_SEEDS } from "@/lib/server/ai/prompts-b2b/image-seeds";
import { B2BSettingsService } from "@/lib/server/services/b2b-settings.service";
import { getWorkflowStatuses, updateWorkflowStatus } from "@/lib/server/repositories/workflow.repository";
import {
  clearKeywordTrends, clearLongtail, clearProducts, getImageSkill, getImageSkills,
  getKeywordTrends, getKeywordTrendsFetchedAt, getListing, getListings, getLongtail, getProduct, getProducts,
  getTrendSnapshots, incrementImageSkillUsage, insertImageSkill, insertKeywordTrend, insertListing,
  insertLongtail, insertProduct, replaceTrendSnapshots, updateImageSkill, updateListing,
} from "@/lib/server/repositories/b2b.repository";
import { prisma } from "@/lib/server/db";
import type {
  AlibabaProduct, B2BListingDraft, B2BPreference, ContentImage, DailyDigestResult, ImageSkill,
  KeywordTrendsResult, ListingPublishResult, ListingRecommendation, LongtailKeyword, PushTestResult,
  ReversePromptResult, TrendPlatform, TrendRising,
} from "@/lib/shared/types";

interface Bumpable {
  status?: string;
  lastRun?: string;
  runCount?: number;
}

const SETTINGS_CTA = "请前往「设置 → B 端运营」检查密钥配置，或稍后重试。";

// ── 并发去重：同 key 的付费抓取合并为一次（双开页面/双击不重复花钱）──
const inFlight = new Map<string, Promise<unknown>>();

function dedup<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = run().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

function shouldClearCache(
  failureCategory: string | undefined,
  errCategory: string | undefined,
): boolean {
  const env = ["environment", "config_missing"];
  if (failureCategory && env.includes(failureCategory)) return true;
  if (errCategory && env.includes(errCategory)) return true;
  return false;
}

function withCta(warning: string | undefined, fallback: string): string {
  const raw = warning?.trim();
  let base: string;
  if (raw) {
    base = raw.endsWith("。") || raw.endsWith("！") || raw.endsWith("？") ? raw : `${raw}。`;
  } else {
    base = fallback.endsWith("。") ? fallback : `${fallback}。`;
  }
  base = base.replace(/[。！？]{2,}/g, (match) => match.slice(-1));
  const already =
    base.includes(SETTINGS_CTA) ||
    base.includes("设置 → B 端运营") ||
    base.includes("设置->B端运营") ||
    base.includes("B 端运营");
  return already ? base : `${base} ${SETTINGS_CTA}`;
}

export class B2BService {
  private mcp = new ContentMCPClient();
  private settings = new B2BSettingsService();

  getMCPStatus() {
    return this.mcp.getStats();
  }

  // ── 关键词趋势 ──

  async getKeywordTrends(platform: TrendPlatform) {
    return await getKeywordTrends(platform);
  }

  async fetchKeywordTrends(input: { platform: TrendPlatform; industryId?: number; keyword?: string; refresh?: boolean }): Promise<KeywordTrendsResult> {
    // 并发去重：同平台+关键词的抓取合并（双开页面/狂点刷新只付一次钱）
    return dedup(`kw-trends:${input.platform}:${input.industryId ?? ""}:${input.keyword ?? ""}`, async () => {
    const cached = await getKeywordTrends(input.platform);

    // 自举 TikHub（AI_TRENDS_API_KEY 在父目录 .env，next.config.ts 启动注入）：
    // 主路径全走 REST，不再依赖 flowmind MCP 与浏览器 cookie 透传。
    // IG 网页端无匿名全站榜单，话题搜索必需关键词：
    // 自动挖取（每日刷新/无词刷新）时按日期轮换跨境品类词池，保证每天出真实 IG 话题数据
    let keyword = input.keyword;
    if (input.platform === "instagram" && !keyword) {
      const IG_DAILY_POOL = [
        "handbag", "jewelry", "skincare", "sneakers", "dress",
        "sunglasses", "watch", "hairaccessories", "homegoods", "petproducts",
      ];
      const dayIdx = Math.floor(Date.now() / 86_400_000) % IG_DAILY_POOL.length;
      keyword = IG_DAILY_POOL[dayIdx];
    }

    this.bump("keyword-trend", "running").catch(console.error);
    try {
      const result = await getTikHubClient().fetchTrends({
        platform: input.platform === "alibaba" ? "tiktok" : input.platform,
        industryId: input.industryId,
        keyword,
        limit: 30,
      });

      const keywords = (result.keywords ?? []).map((k) => ({
        word: k.word, heat: k.heat, delta: k.delta, rank: k.rank, industry: k.industry, source: k.source,
      }));

      if (result.degraded && shouldClearCache(result.failure_category, undefined)) {
        clearKeywordTrends(input.platform).catch(console.error);
      } else if (!result.degraded || keywords.length > 0) {
        this.safePersistKeywordTrends(input.platform, String(input.industryId ?? ""), keywords).catch(console.error);
      }

      const hasCachedFallback = !result.degraded && keywords.length === 0 && cached.length > 0 && !input.refresh;

      return {
        platform: input.platform,
        source: hasCachedFallback ? "cache" : result.source,
        degraded: result.degraded || (keywords.length === 0 && cached.length === 0),
        keywords: hasCachedFallback ? cached : keywords,
        failureCategory: result.failure_category,
        retriable: result.retriable,
        fetchedAt: new Date().toISOString(),
        warning: result.degraded || keywords.length === 0
          ? withCta(result.warning, keywords.length === 0 ? "暂无关键词趋势数据" : "趋势接口降级返回")
          : undefined,
      };
    } catch (err) {
      const category = failureCategoryOf(err);
      if (category && shouldClearCache(undefined, category)) {
        clearKeywordTrends(input.platform).catch(console.error);
      }
      if (cached.length > 0) {
        return {
          platform: input.platform,
          source: "cache_stale",
          degraded: true,
          keywords: cached,
          fetchedAt: (await getKeywordTrendsFetchedAt(input.platform).catch(() => null)) ?? undefined,
          failureCategory: category,
          retriable: retriableOf(err) ?? true,
          warning: withCta(err instanceof Error ? err.message : undefined, "趋势服务暂时不可用，展示历史缓存"),
        };
      }
      return {
        platform: input.platform,
        source: "selfhost_error",
        degraded: true,
        keywords: [],
        failureCategory: category,
        retriable: retriableOf(err) ?? true,
        warning: withCta(err instanceof Error ? err.message : undefined, "趋势服务暂时不可用"),
      };
    } finally {
      this.bump("keyword-trend", "idle").catch(console.error);
    }
    });
  }

  // ── 长尾词 ──

  async getLongtail(industry: string): Promise<LongtailKeyword[]> {
    return await getLongtail(industry);
  }

  async generateLongtail(input: { industry: string; seedKeywords: string[]; limit?: number }): Promise<LongtailKeyword[]> {
    this.bump("keyword-trend", "running").catch(console.error);
    try {
      // 自举：云 LLM 结构化生成（复用 AI_LLM_* 网关），不再依赖 flowmind MCP
      const keywords = await selfhostGenerateLongtail({
        industry: input.industry,
        seedKeywords: input.seedKeywords ?? [],
        limit: input.limit ?? 20,
      });

      if (keywords.length > 0) {
        this.safePersistLongtail(input.industry, keywords).catch(console.error);
      }
      return keywords;
    } catch (err) {
      const category = failureCategoryOf(err);
      if (category && shouldClearCache(undefined, category)) {
        clearLongtail(input.industry).catch(console.error);
      }
      const cached = await getLongtail(input.industry);
      if (cached.length > 0) return cached;
      throw err;
    } finally {
      this.bump("keyword-trend", "idle").catch(console.error);
    }
  }

  // ── 商品池 ──

  async getProducts(): Promise<AlibabaProduct[]> {
    return await getProducts();
  }

  async fetchProducts(input: { refresh?: boolean } = {}): Promise<{ products: AlibabaProduct[]; authorized: boolean; degraded?: boolean; warning?: string; failureCategory?: string; retriable?: boolean; fetchedAt?: string }> {
    const cached = await getProducts();
    this.bump("b2b-listing", "running").catch(console.error);
    try {
      // 自举：TOP 协议直连阿里开放 API（HMAC-MD5 签名），不再走 flowmind MCP
      const data = await alibabaTopCall("alibaba.product.list", { pageNo: 1, pageSize: 50 });
      const products: AlibabaProduct[] = normalizeAlibabaProducts(data).map((p) => ({
        productId: String(p.product_id ?? p.productId ?? ""),
        subject: String(p.subject ?? ""),
        keywords: Array.isArray(p.keywords) ? p.keywords.map(String) : [],
        imageUrl: String(p.image_url ?? p.imageUrl ?? ""),
        price: String(p.price ?? ""),
        status: String(p.status ?? ""),
      }));

      if (products.length > 0) {
        this.safePersistProducts(products).catch(console.error);
      }

      const fallback = products.length === 0 && cached.length > 0 && !input.refresh;

      return {
        products: fallback ? cached : products,
        authorized: true,
        degraded: products.length === 0,
        failureCategory: products.length === 0 ? "empty" : undefined,
        retriable: products.length === 0,
        fetchedAt: new Date().toISOString(),
        warning: products.length === 0 ? withCta(undefined, "阿里国际站未返回在线商品") : undefined,
      };
    } catch (err) {
      const authMissing = err instanceof AlibabaAuthError;
      if (cached.length > 0) {
        return {
          products: cached, authorized: !authMissing, degraded: true,
          failureCategory: authMissing ? "config_missing" : "environment",
          retriable: !authMissing,
          warning: withCta(
            err instanceof Error ? err.message : undefined,
            "阿里国际站暂时不可用，展示历史商品",
          ),
        };
      }
      return {
        products: [], authorized: !authMissing, degraded: true,
        failureCategory: authMissing ? "config_missing" : "environment",
        retriable: !authMissing,
        warning: withCta(
          err instanceof Error ? err.message : undefined,
          authMissing
            ? "未配置阿里国际站开放平台凭证（ALIBABA_APP_KEY/APP_SECRET/SESSION），无法拉取在线商品"
            : "阿里国际站接口暂不可用",
        ),
      };
    } finally {
      this.bump("b2b-listing", "idle").catch(console.error);
    }
  }

  // ── 推荐 ──

  async recommend(input: {
    preference: B2BPreference; trendKeywords: KeywordTrendsResult["keywords"]; longtailKeywords: LongtailKeyword[];
  }): Promise<ListingRecommendation[]> {
    this.bump("b2b-listing", "running").catch(console.error);
    try {
      const products = await getProducts();
      // 自举 RAG：先用趋势词对商品池语义检索 top-N（Milvus product zone），命中则只喂
      // 高度相关商品，避免把全量商品池塞进 prompt（控 token 提相关度）；检索失败退化全量前 12。
      const relevant = await selfhostTopProductsForTrends(products, input.trendKeywords);
      return await selfhostRecommendProducts({
        preference: input.preference,
        products: relevant,
        trendKeywords: input.trendKeywords,
        longtailKeywords: input.longtailKeywords,
      });
    } finally {
      this.bump("b2b-listing", "idle").catch(console.error);
    }
  }

  // ── Listing 生成 / 发布 ──

  async getListings(): Promise<B2BListingDraft[]> {
    return await getListings();
  }

  async generateListing(input: { productId: string; subject?: string; keyword?: string; preference: B2BPreference }): Promise<B2BListingDraft> {
    this.bump("b2b-listing", "running").catch(console.error);
    try {
      const product = await getProduct(input.productId);
      // 自举：五层提示词（identity/knowledge/task/contract）+ L3 确定性校验 +
      // error 级问题 LLM 自动修复复检（lib/server/ai/prompts-b2b），不再走 flowmind MCP
      const result = await selfhostGenerateListingDraft({
        productId: input.productId,
        subject: input.subject || product?.subject || input.productId,
        keyword: input.keyword || product?.keywords?.[0] || "",
        productKeywords: product?.keywords ?? [],
        preference: input.preference,
      });

      const id = `ls-${Date.now()}`;
      await insertListing({
        id, productId: input.productId, preference: input.preference,
        title: result.title, description: result.description,
        keywords: result.keywords, imageUrl: product?.imageUrl ?? "", imagePrompt: result.imagePrompt,
      });
      const draft = await getListing(id);
      if (!draft) throw new Error("Listing 草稿写入失败");
      return result.warnings.length ? { ...draft, warnings: result.warnings } : draft;
    } finally {
      this.bump("b2b-listing", "idle").catch(console.error);
    }
  }

  async publishListing(input: { listingId: string }): Promise<ListingPublishResult> {
    try {
      const draft = await getListing(input.listingId);
      if (!draft) {
        return {
          productId: "",
          strProductId: "",
          posted: false,
          error: "Listing 草稿不存在，请先 AI 生成 Listing 再上传",
        };
      }
      this.bump("b2b-listing", "running").catch(console.error);
      await updateListing(draft.id, { uploadStatus: "uploading" });

      // 自举：TOP 协议直连阿里发品（替代 flowmind MCP alibaba_product_post）。
      // MCP 端若不可用不再导致黑盒失败——真实错误/缺必填都从阿里返回。
      const biz: Record<string, unknown> = {
        subject: draft.title,
        keywords: draft.keywords,
        description: draft.description,
        product_type: "sourcing",
      };
      if (draft.imageUrl) biz["product_image.image_file_list.1.image_file_url"] = draft.imageUrl;

      const data = await alibabaTopCall("alibaba.icbu.product.add", biz);
      const result = {
        product_id: String(data.product_id ?? ""),
        str_product_id: String(data.str_product_id ?? ""),
        posted: Boolean(data.product_id || data.str_product_id),
        warnings: [] as string[],
      };
      const warnings = Array.isArray(result.warnings) ? result.warnings : [];
      await updateListing(draft.id, {
        uploadStatus: result.posted ? "uploaded" : "failed",
        uploadedProductId: result.product_id || result.str_product_id,
      });
      return {
        productId: result.product_id,
        strProductId: result.str_product_id,
        posted: result.posted,
        warnings: warnings.length ? warnings : undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "上传发布失败";
      try {
        const draft = await getListing(input.listingId);
        if (draft) await updateListing(draft.id, { uploadStatus: "failed" });
      } catch {}
      return {
        productId: "",
        strProductId: "",
        posted: false,
        error: msg,
      };
    } finally {
      this.bump("b2b-listing", "idle").catch(console.error);
    }
  }

  // ── 推送测试 ──

  async testPush(input: { channel: "feishu" | "wecom" }): Promise<PushTestResult> {
    const title = "B端工作台测试推送";
    const markdown = `这是一条**测试卡片**。配置正确后，每日 08:00 将自动推送三平台关键词趋势榜单。`;
    // 自举：webhook URL 从「设置 → B 端运营」KV（DB）+ env 读取，直接发 HTTP，不再走 flowmind MCP
    const settings = await this.settings.getSettings();
    const url = input.channel === "feishu" ? settings.feishuWebhookUrl : settings.wecomWebhookUrl;
    if (!url) {
      return {
        channel: input.channel,
        ok: false,
        latencyMs: 0,
        error: `${input.channel === "feishu" ? "飞书" : "企微"} webhook 未配置（请到「设置 → B 端运营」填写）`,
      };
    }
    const t0 = Date.now();
    try {
      const body =
        input.channel === "feishu"
          ? { msg_type: "interactive", card: { header: { title: { tag: "plain_text", content: title }, template: "blue" }, elements: [{ tag: "markdown", content: markdown }] } }
          : { msgtype: "markdown", markdown: { content: markdown } };
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      const json = (await r.json().catch(() => ({}))) as { code?: number; errcode?: number; errmsg?: string };
      const ok = r.ok && (json.code === 0 || json.code === undefined) && (json.errcode === 0 || json.errcode === undefined);
      return { channel: input.channel, ok, latencyMs: Date.now() - t0, error: ok ? undefined : (json.errmsg ?? `HTTP ${r.status}`) };
    } catch (err) {
      return { channel: input.channel, ok: false, latencyMs: Date.now() - t0, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── 每日摘要（b2b_daily_digest 自举：TikHub 趋势 + LLM 长尾 + webhook 推送）──

  async runDailyDigest(input: { pushFeishu: boolean; pushWecom: boolean; limit?: number }): Promise<DailyDigestResult> {
    this.bump("keyword-trend", "running").catch(console.error);
    try {
      const limit = input.limit ?? 10;
      const [tt, longtail, settings] = await Promise.all([
        getTikHubClient().fetchTiktokTrends(undefined, limit),
        selfhostGenerateLongtail({ industry: "cross-border", seedKeywords: [], limit: 20 }).catch(() => []),
        this.settings.getSettings(),
      ]);

      const sections: DailyDigestResult["sections"] = [{
        platform: "tiktok",
        label: "TikTok 热榜",
        source: "tikhub",
        degraded: tt.length === 0,
        keywords: tt.slice(0, limit).map((k) => ({ word: k.word, heat: k.heat, rank: k.rank })),
      }];

      // 趋势归因（prompts-b2b 分析师提示词）：失败不阻塞摘要推送
      const attribution = await selfhostAnalyzeTrendDigest({
        platform: "TikTok",
        keywords: tt.slice(0, limit),
        longtailKeywords: longtail,
      }).catch(() => null);

      const markdown = [
        `# 每日跨境趋势摘要（${new Date().toISOString().slice(0, 10)}）`,
        "",
        "## TikTok 热榜 TOP",
        ...tt.slice(0, limit).map((k, i) => `${i + 1}. **${k.word}** — ${k.heat} 播放`),
        "",
        "## 长尾词建议",
        ...(longtail.slice(0, 10).map((k) => `- ${k.word}`) || ["（暂无）"]),
        ...(attribution
          ? [
              "",
              `## 趋势归因：${attribution.headline}`,
              ...attribution.attribution.map((a) => `- ${a}`),
              "",
              "## 今日行动建议",
              ...attribution.actions.map((a) => `- ${a}`),
            ]
          : []),
      ].join("\n");

      const pushes: DailyDigestResult["pushes"] = [];
      const pushTargets = [
        { channel: "feishu" as const, url: settings.feishuWebhookUrl, on: input.pushFeishu },
        { channel: "wecom" as const, url: settings.wecomWebhookUrl, on: input.pushWecom },
      ];
      for (const t of pushTargets) {
        if (!t.on) continue;
        if (!t.url) {
          pushes.push({ channel: t.channel, ok: false, latencyMs: 0, error: "webhook 未配置" });
          continue;
        }
        const t0 = Date.now();
        try {
          const body =
            t.channel === "feishu"
              ? { msg_type: "interactive", card: { header: { title: { tag: "plain_text", content: "每日跨境趋势摘要" }, template: "blue" }, elements: [{ tag: "markdown", content: markdown }] } }
              : { msgtype: "markdown", markdown: { content: markdown } };
          const r = await fetch(t.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10_000),
          });
          const ok = r.ok;
          pushes.push({ channel: t.channel, ok, latencyMs: Date.now() - t0, error: ok ? undefined : `HTTP ${r.status}` });
        } catch (err) {
          pushes.push({ channel: t.channel, ok: false, latencyMs: Date.now() - t0, error: err instanceof Error ? err.message : String(err) });
        }
      }

      return {
        date: new Date().toISOString().slice(0, 10),
        sections,
        longtailWords: longtail.slice(0, 10).map((k) => k.word),
        longtailError: longtail.length ? undefined : "长尾词生成失败",
        markdown,
        pushes,
      };
    } finally {
      this.bump("keyword-trend", "idle").catch(console.error);
    }
  }

  // ── 生图 Skill 库 ──

  async getImageSkills(): Promise<ImageSkill[]> {
    await this.ensureBuiltinImageSkills();
    return await getImageSkills();
  }

  /** 官方模板懒加载种子：固定 id + skipDuplicates，幂等可重入（运营资料固化为内置 Skill）。 */
  private async ensureBuiltinImageSkills(): Promise<void> {
    try {
      for (const seed of BUILTIN_IMAGE_SKILL_SEEDS) {
        await insertImageSkill({
          id: seed.id,
          name: seed.name,
          coverUrl: seed.coverUrl,
          reversedPrompt: seed.reversedPrompt,
          styleTags: seed.styleTags,
          aspectRatio: seed.aspectRatio,
          platform: seed.platform,
          templateType: seed.templateType,
          isBuiltin: true,
        });
      }
    } catch { /* 非关键路径：种子写入失败不阻塞 Skill 列表 */ }
  }

  async reversePrompt(input: { imageUrl: string; hint?: string }): Promise<ReversePromptResult> {
    // 自举：云 LLM 视觉理解反推绘图提示词（复用 AI_LLM_* 网关），不再走 flowmind MCP
    try {
      const model = await getAISDKModel();
      const res = await generateText({
        model,
        system:
          "你是 AI 绘图提示词工程师。根据图片 URL 与描述，输出 JSON：{\"prompt\":\"完整英文提示词\",\"style_tags\":[\"...\"],\"negative_prompt\":\"负面提示词\"}，只输出 JSON。",
        prompt: `图片URL：${input.imageUrl}\n补充说明：${input.hint ?? "无"}`,
        temperature: 0.4,
      });
      const text = res.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end >= start) {
        const parsed = JSON.parse(text.slice(start, end + 1)) as { prompt?: string; style_tags?: string[]; negative_prompt?: string };
        return {
          prompt: String(parsed.prompt ?? "").trim(),
          styleTags: Array.isArray(parsed.style_tags) ? parsed.style_tags.map((t) => String(t)) : [],
          negativePrompt: String(parsed.negative_prompt ?? "").trim(),
        };
      }
      throw new Error("模型未返回 JSON");
    } catch (err) {
      throw new SelfhostError("unknown", `图转 prompt 失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async createImageSkill(input: {
    name: string; coverUrl: string; reversedPrompt: string; styleTags: string[];
    aspectRatio: string; platform?: string; templateType?: ImageSkill["templateType"];
    isBuiltin?: boolean;
  }): Promise<ImageSkill> {
    const id = `is-${Date.now()}`;
    await insertImageSkill({
      id, name: input.name, coverUrl: input.coverUrl, reversedPrompt: input.reversedPrompt,
      styleTags: input.styleTags, aspectRatio: input.aspectRatio || "1:1",
      platform: input.platform || "generic",
      templateType: input.templateType ?? "",
      isBuiltin: input.isBuiltin ?? false,
    });
    const skill = await getImageSkill(id);
    if (!skill) throw new Error("生图 skill 写入失败");
    return skill;
  }

  async duplicateBuiltinSkill(builtinSkillId: string, newName: string): Promise<ImageSkill> {
    const src = await getImageSkill(builtinSkillId);
    if (!src) throw new Error("官方模板不存在");
    if (!src.isBuiltin) throw new Error("该 Skill 不是官方模板，无需复制");
    return this.createImageSkill({
      name: newName?.trim() || `${src.name} 副本`,
      coverUrl: src.coverUrl,
      reversedPrompt: src.reversedPrompt,
      styleTags: [...src.styleTags],
      aspectRatio: src.aspectRatio,
      platform: src.platform,
      templateType: src.templateType,
      isBuiltin: false,
    });
  }

  async deleteImageSkill(id: string): Promise<void> {
    const skill = await getImageSkill(id);
    if (!skill) return;
    if (skill.isBuiltin) throw new Error("官方模板不允许删除，请先复制为个人 Skill 后删除");
    await prisma.wf_image_skills.deleteMany({ where: { id } });
  }

  async updateImageSkill(id: string, data: { name?: string; reversedPrompt?: string; styleTags?: string[]; aspectRatio?: string; templateType?: ImageSkill["templateType"] }): Promise<ImageSkill | null> {
    if (!await getImageSkill(id)) return null;
    await updateImageSkill(id, data);
    return await getImageSkill(id);
  }

  async generateWithSkill(input: { skillId: string; prompt?: string }): Promise<ContentImage[]> {
    const skill = await getImageSkill(input.skillId);
    if (!skill) throw new Error("生图 skill 不存在");
    this.bump("image-skill", "running").catch(console.error);
    try {
      const prompt = input.prompt?.trim()
        ? `${skill.reversedPrompt}\n\n附加要求：${input.prompt.trim()}`
        : skill.reversedPrompt;
      // 自举：OpenAI 兼容 images/generations（SiliconFlow Kolors），
      // 不再依赖 flowmind MCP；基础生图接口不支持 reference_image_url（封面仅作展示用）。
      const result = await selfhostGenerateImages({
        prompt,
        aspectRatio: skill.aspectRatio || "1:1",
        numVariants: 1,
      });
      await incrementImageSkillUsage(skill.id);
      return result.images;
    } finally {
      this.bump("image-skill", "idle").catch(console.error);
    }
  }

  // ── 内部辅助 ──

  private async safePersistKeywordTrends(platform: TrendPlatform, industryId: string, keywords: KeywordTrendsResult["keywords"]): Promise<void> {
    try {
      await clearKeywordTrends(platform);
      keywords.forEach(async (k, i) => {
        await insertKeywordTrend({
          id: `kt-${platform}-${Date.now()}-${i}`,
          platform, industryId, word: k.word, heat: k.heat, delta: k.delta,
          rank: k.rank, industry: k.industry, source: k.source,
        });
      });
      // P1：同步写当日时序快照（幂等），供迷你趋势线/飙升榜
      await replaceTrendSnapshots(platform, keywords).catch(console.error);
    } catch { /* 非关键路径 */ }
  }

  /** 趋势时序：近 days 天快照聚合出的飙升榜（按环比涨幅降序）+ 每词 sparkline。 */
  async getTrendRising(platform: TrendPlatform, days = 14): Promise<{ dates: string[]; rising: TrendRising[] }> {
    const rows = await getTrendSnapshots(platform, days);
    const dateSet = Array.from(new Set(rows.map((r) => r.snapshotDate))).sort();
    // word -> 按日期对齐的热度序列
    const byWord = new Map<string, { spark: number[]; last: number; first: number; rank: number; industry: string; delta: number | null }>();
    for (const w of new Set(rows.map((r) => r.word))) {
      const pts = rows.filter((r) => r.word === w);
      const heatByDate = new Map(pts.map((p) => [p.snapshotDate, p.heat]));
      const spark = dateSet.map((d) => heatByDate.get(d) ?? 0);
      const lastPt = pts[pts.length - 1];
      byWord.set(w, {
        spark, first: pts[0].heat, last: lastPt.heat,
        rank: lastPt.rank, industry: lastPt.industry, delta: lastPt.delta,
      });
    }
    const rising: TrendRising[] = [];
    for (const [word, v] of byWord) {
      if (v.spark.length < 2) continue; // 至少两天才能看变化
      const deltaAbs = v.last - v.first;
      const deltaPct = v.first > 0 ? Math.round((deltaAbs / v.first) * 1000) / 10 : null;
      rising.push({
        word, heat: v.last, delta: v.delta, deltaPct, rank: v.rank,
        spark: v.spark, industry: v.industry,
      });
    }
    rising.sort((a, b) => {
      const av = a.deltaPct ?? Number.NEGATIVE_INFINITY;
      const bv = b.deltaPct ?? Number.NEGATIVE_INFINITY;
      return bv - av;
    });
    return { dates: dateSet, rising: rising.slice(0, 30) };
  }

  private async safePersistLongtail(industry: string, keywords: LongtailKeyword[]): Promise<void> {
    try {
      await clearLongtail(industry);
      keywords.forEach(async (k, i) => {
        await insertLongtail({
          id: `lt-${industry}-${Date.now()}-${i}`, industry, word: k.word, category: k.category, searchIntent: k.searchIntent,
        });
      });
    } catch { /* 非关键路径 */ }
  }

  private async safePersistProducts(products: AlibabaProduct[]): Promise<void> {
    try {
      await clearProducts();
      for (const p of products) await insertProduct(p);
      // 同步进语义知识库（product zone），供 recommend 作 RAG 检索
      const { bulkUpsertB2BKb, deleteB2BKb } = await import("@/lib/server/db/b2b-kb");
      const docs = products.map((p) => ({
        id: `p-${p.productId}`,
        zone: "product" as const,
        title: p.subject,
        content: [p.subject, ...(p.keywords ?? [])].join(" "),
        tags: p.keywords ?? [],
        meta: { productId: p.productId, imageUrl: p.imageUrl ?? "", price: p.price ?? "" },
      }));
      try {
        const { ensureB2BKbCollection } = await import("@/lib/server/db/b2b-kb");
        await ensureB2BKbCollection();
        // 简单全量重建：先清空 product zone 再批量写，避免残留已下架商品
        await deleteB2BKb(`id like "p-%"`).catch(() => {});
        await bulkUpsertB2BKb(docs);
      } catch { /* 向量库不可用不影响商品落地 */ }
    } catch { /* 非关键路径 */ }
  }

  private async bump(workflowId: string, status: "running" | "idle"): Promise<void> {
    try {
      const current = (await getWorkflowStatuses()).find((w) => w.id === workflowId);
      const newRuns = (current?.runs ?? 0) + (status === "idle" ? 1 : 0);
      const data: Bumpable = { status };
      if (status === "idle") {
        data.lastRun = new Date().toISOString();
        data.runCount = newRuns;
      }
      await updateWorkflowStatus(workflowId, data);
    } catch { /* 非关键 */ }
  }
}

// ── 阿里国际站 TOP 协议客户端（自举直连，替代 flowmind MCP alibaba_product_list）──

class AlibabaAuthError extends Error {}

/** GMT+8 时间戳（TOP 协议要求 "YYYY-MM-DD HH:mm:ss"）。 */
function gmt8Timestamp(): string {
  const now = new Date(Date.now() + 8 * 3600_000);
  return now.toISOString().replace("T", " ").slice(0, 19);
}

/** HMAC-MD5 签名：key=secret，data=按 key 字典序拼接的 key+value，结果大写。 */
function alibabaSign(params: Record<string, string>, secret: string): string {
  const base = Object.keys(params).sort().map((k) => `${k}${params[k]}`).join("");
  return createHmac("md5", secret).update(base, "utf8").digest("hex").toUpperCase();
}

/** 调用阿里国际站开放 API（TOP 协议，POST form）。业务参数 dict/list 走 JSON 序列化。 */
async function alibabaTopCall(
  method: string,
  bizParams: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const appKey = process.env.ALIBABA_APP_KEY?.trim();
  const appSecret = process.env.ALIBABA_APP_SECRET?.trim();
  const session = process.env.ALIBABA_SESSION?.trim();
  const apiBase = process.env.ALIBABA_API_BASE?.trim() || "https://openapi.alibaba.com/router/rest";
  if (!appKey || !appSecret) {
    throw new AlibabaAuthError("未配置 ALIBABA_APP_KEY / ALIBABA_APP_SECRET");
  }

  const params: Record<string, string> = {
    method,
    app_key: appKey,
    timestamp: gmt8Timestamp(),
    format: "json",
    v: "2.0",
    sign_method: "hmac",
  };
  if (session) params.session = session;
  for (const [k, v] of Object.entries(bizParams)) {
    params[k] = v !== null && typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
  }
  params.sign = alibabaSign(params, appSecret);

  let res: Response;
  try {
    res = await fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new Error(`阿里国际站连接失败：${err instanceof Error ? err.name : "网络错误"}`);
  }
  if (res.status >= 500) throw new Error(`阿里国际站 HTTP ${res.status}`);
  if (res.status >= 400) throw new Error(`阿里国际站 HTTP ${res.status}`);
  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new Error("阿里国际站返回非法 JSON");
  }
  const errBlock = (data.error_response ?? {}) as Record<string, unknown>;
  if (errBlock && Object.keys(errBlock).length > 0) {
    const code = String(errBlock.code ?? errBlock.sub_code ?? "UNKNOWN");
    const msg = String(errBlock.msg ?? errBlock.sub_msg ?? "接口返回错误");
    throw new Error(`阿里国际站接口错误 ${code}：${msg}`);
  }
  return data;
}

/** 宽容解析不同接口返回结构，归一化为商品行（对齐后端 alibaba_product_list._normalize）。 */
function normalizeAlibabaProducts(data: Record<string, unknown>): Array<Record<string, unknown>> {
  // 顶层可能是 { alibaba_product_list_response: {...} } 或 { result: {...} } 或平铺
  let root: Record<string, unknown> = data;
  const respKey = Object.keys(data).find((k) => k.includes("_response"));
  if (respKey && data[respKey] && typeof data[respKey] === "object") {
    root = data[respKey] as Record<string, unknown>;
  }
  let list: unknown[] = [];
  for (const key of ["products", "product_list", "result", "data"]) {
    const v = root[key];
    if (Array.isArray(v)) { list = v; break; }
    if (v && typeof v === "object") {
      const inner = v as Record<string, unknown>;
      for (const ik of ["products", "product_list", "list", "records"]) {
        if (Array.isArray(inner[ik])) { list = inner[ik]; break; }
      }
      if (list.length) break;
    }
  }
  return list.filter((it): it is Record<string, unknown> => !!it && typeof it === "object");
}

export { ContentMCPError };
