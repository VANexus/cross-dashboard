/**
 * FlowMind — B端运营工作台 Service
 *
 * 业务编排层：调 flowmind MCP 技能（b2b_* / alibaba_* / image_prompt_reverse / marketing_image_gen）+ 落库 + 状态上报。
 * 所有 AI 逻辑与密钥在 flowmind（Python），本层零密钥，只做「调用 + 持久化」。
 */
import { ContentMCPClient, ContentMCPError } from "@/lib/content/mcp-client";
import { getWorkflowStatuses, updateWorkflowStatus } from "@/lib/repositories/workflow.repository";
import {
  clearKeywordTrends, clearLongtail, clearProducts, getImageSkill, getImageSkills,
  getKeywordTrends, getListing, getListings, getLongtail, getProduct, getProducts,
  incrementImageSkillUsage, insertImageSkill, insertKeywordTrend, insertListing, insertLongtail,
  insertProduct, updateImageSkill, updateListing,
} from "@/lib/repositories/b2b.repository";
import { getSupabase } from "@/lib/db";
import type {
  AlibabaProduct, B2BListingDraft, B2BPreference, ContentImage, DailyDigestResult, ImageSkill,
  KeywordTrendsResult, ListingPublishResult, ListingRecommendation, LongtailKeyword, PushTestResult,
  ReversePromptResult, TrendPlatform,
} from "@/lib/types";

interface Bumpable {
  status?: string;
  lastRun?: string;
  runCount?: number;
}

const SETTINGS_CTA = "请前往「设置 → B 端运营」检查密钥配置，或稍后重试。";

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

  getMCPStatus() {
    return this.mcp.getStats();
  }

  // ── 关键词趋势 ──

  async getKeywordTrends(platform: TrendPlatform) {
    return await getKeywordTrends(platform);
  }

  async fetchKeywordTrends(input: { platform: TrendPlatform; industryId?: number; keyword?: string; refresh?: boolean }): Promise<KeywordTrendsResult> {
    const cached = await getKeywordTrends(input.platform);

    // 渠道授权登录会话：TikTok 解锁全量榜单；IG 必需
    const settings = await new (await import("./b2b-settings.service")).B2BSettingsService().getSettings();
    const sessionCookie =
      input.platform === "instagram" ? settings.instagramSessionCookie :
      input.platform === "tiktok" ? settings.tiktokSessionCookie : "";

    this.bump("keyword-trend", "running").catch(console.error);
    try {
      const result = await this.mcp.call<{
        platform: string; source: string; degraded: boolean;
        keywords: Array<{ word: string; heat: number; delta: number | null; rank: number; industry: string; source: string }>;
        failure_category?: string; retriable?: boolean; warning?: string;
      }>("b2b_keyword_trends", {
        platform: input.platform,
        industry_id: input.industryId,
        keyword: input.keyword,
        session_cookie: sessionCookie || undefined,
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
        warning: result.degraded || keywords.length === 0
          ? withCta(result.warning, keywords.length === 0 ? "暂无关键词趋势数据" : "趋势接口降级返回")
          : undefined,
      };
    } catch (err) {
      const mcpErr = err instanceof ContentMCPError ? err : null;
      if (mcpErr && shouldClearCache(undefined, mcpErr.category)) {
        clearKeywordTrends(input.platform).catch(console.error);
      }
      if (cached.length > 0) {
        return {
          platform: input.platform,
          source: "cache_stale",
          degraded: true,
          keywords: cached,
          failureCategory: mcpErr?.category,
          retriable: mcpErr?.retriable ?? true,
          warning: withCta(mcpErr?.message, "MCP 服务暂时不可用，展示历史缓存"),
        };
      }
      if (mcpErr) {
        return {
          platform: input.platform,
          source: "mcp_error",
          degraded: true,
          keywords: [],
          failureCategory: mcpErr.category,
          retriable: mcpErr.retriable,
          warning: withCta(mcpErr.message, "MCP 服务暂时不可用"),
        };
      }
      throw err;
    } finally {
      this.bump("keyword-trend", "idle").catch(console.error);
    }
  }

  // ── 长尾词 ──

  async getLongtail(industry: string): Promise<LongtailKeyword[]> {
    return await getLongtail(industry);
  }

  async generateLongtail(input: { industry: string; seedKeywords: string[]; limit?: number }): Promise<LongtailKeyword[]> {
    this.bump("keyword-trend", "running").catch(console.error);
    try {
      const result = await this.mcp.call<{
        industry: string; degraded?: boolean; failure_category?: string; retriable?: boolean; warning?: string;
        keywords: Array<{ word: string; category: string; search_intent: string }>;
      }>("b2b_longtail_keywords", {
        industry: input.industry,
        seed_keywords: input.seedKeywords ?? [],
        limit: input.limit ?? 20,
      });

      const keywords: LongtailKeyword[] = (result.keywords ?? []).map((k) => ({
        word: k.word, category: k.category, searchIntent: k.search_intent ?? "",
      }));

      if (result.degraded && shouldClearCache(result.failure_category, undefined)) {
        clearLongtail(input.industry).catch(console.error);
      } else if (keywords.length > 0) {
        this.safePersistLongtail(input.industry, keywords).catch(console.error);
      }
      return keywords;
    } catch (err) {
      const mcpErr = err instanceof ContentMCPError ? err : null;
      if (mcpErr && shouldClearCache(undefined, mcpErr.category)) {
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

  async fetchProducts(input: { refresh?: boolean } = {}): Promise<{ products: AlibabaProduct[]; authorized: boolean; degraded?: boolean; warning?: string; failureCategory?: string; retriable?: boolean }> {
    const cached = await getProducts();
    this.bump("b2b-listing", "running").catch(console.error);
    try {
      const result = await this.mcp.call<{
        total: number; degraded?: boolean; failure_category?: string; retriable?: boolean;
        products: Array<{ product_id: string; subject: string; keywords: string[]; image_url: string; price: string; status: string }>;
        authorized: boolean; warning?: string;
      }>("alibaba_product_list", { page: 1, page_size: 50, status: "onSelling" });

      const products: AlibabaProduct[] = (result.products ?? []).map((p) => ({
        productId: p.product_id, subject: p.subject, keywords: p.keywords ?? [],
        imageUrl: p.image_url, price: p.price, status: p.status,
      }));

      if (result.degraded && shouldClearCache(result.failure_category, undefined)) {
        clearProducts().catch(console.error);
      } else if (!result.degraded || products.length > 0) {
        this.safePersistProducts(products).catch(console.error);
      }

      const fallback = !result.degraded && products.length === 0 && cached.length > 0 && !input.refresh;

      return {
        products: fallback ? cached : products,
        authorized: result.authorized,
        degraded: result.degraded || (products.length === 0 && cached.length === 0 && !result.authorized),
        failureCategory: result.failure_category,
        retriable: result.retriable,
        warning: result.degraded || products.length === 0
          ? withCta(result.warning, products.length === 0 ? "暂无商品数据" : "商品接口降级返回")
          : undefined,
      };
    } catch (err) {
      const mcpErr = err instanceof ContentMCPError ? err : null;
      if (mcpErr && shouldClearCache(undefined, mcpErr.category)) {
        clearProducts().catch(console.error);
      }
      if (cached.length > 0) {
        return {
          products: cached, authorized: true, degraded: true,
          failureCategory: mcpErr?.category, retriable: mcpErr?.retriable ?? true,
          warning: withCta(mcpErr?.message, "MCP 服务暂时不可用，展示历史商品"),
        };
      }
      if (mcpErr) {
        return {
          products: [], authorized: false, degraded: true,
          failureCategory: mcpErr.category, retriable: mcpErr.retriable,
          warning: withCta(mcpErr.message, "MCP 服务暂时不可用"),
        };
      }
      throw err;
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
      const result = await this.mcp.call<{
        preference: string;
        recommendations: Array<{ product_id: string; subject: string; score: number; reasons: string[] }>;
      }>("alibaba_product_recommend", {
        preference: input.preference,
        products: products.map((p) => ({ product_id: p.productId, subject: p.subject, keywords: p.keywords })),
        trend_keywords: input.trendKeywords,
        longtail_keywords: input.longtailKeywords,
        max_items: 5,
      });
      return (result.recommendations ?? []).map((r) => ({
        productId: r.product_id, subject: r.subject, score: r.score, reasons: r.reasons ?? [],
      }));
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
      const result = await this.mcp.call<{
        product_id: string;
        title: string;
        description: string;
        keywords: string[];
        image_prompt: string;
        warnings?: string[];
      }>("alibaba_listing_generate", {
        product_id: input.productId,
        subject: input.subject || product?.subject || input.productId,
        keyword: input.keyword || product?.keywords?.[0] || "",
        preference: input.preference,
        language: "en",
      });

      const warnings = Array.isArray(result.warnings) ? result.warnings : [];
      const id = `ls-${Date.now()}`;
      await insertListing({
        id, productId: input.productId, preference: input.preference,
        title: result.title, description: result.description,
        keywords: result.keywords ?? [], imageUrl: product?.imageUrl ?? "", imagePrompt: result.image_prompt,
      });
      const draft = await getListing(id);
      if (!draft) throw new Error("Listing 草稿写入失败");
      return warnings.length ? { ...draft, warnings } : draft;
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
      const result = await this.mcp.call<{
        product_id: string;
        str_product_id: string;
        posted: boolean;
        warnings?: string[];
      }>("alibaba_product_post", {
        subject: draft.title,
        keywords: draft.keywords,
        description: draft.description,
        image_url: draft.imageUrl,
      });
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
    const result = await this.mcp.call<{ ok: boolean; latency_ms: number; webhook_source?: string; error?: string }>(
      input.channel === "feishu" ? "b2b_push_feishu" : "b2b_push_wecom",
      { title, markdown },
    );
    return {
      channel: input.channel,
      ok: result.ok,
      latencyMs: result.latency_ms,
      error: result.error,
    };
  }

  // ── 每日摘要（b2b_daily_digest 编排）──

  async runDailyDigest(input: { pushFeishu: boolean; pushWecom: boolean; limit?: number }): Promise<DailyDigestResult> {
    this.bump("keyword-trend", "running").catch(console.error);
    try {
      const result = await this.mcp.call<{
        date: string;
        sections: Array<{
          platform: string; label: string; source: string; degraded: boolean;
          failure_category?: string | null;
          keywords: Array<{ word: string; heat: number; rank: number }>;
        }>;
        longtail_words: string[];
        longtail_error?: string | null;
        markdown: string;
        pushes: Array<{ channel: string; ok: boolean; latency_ms: number; error?: string | null }>;
      }>("b2b_daily_digest", {
        limit: input.limit ?? 10,
        push_feishu: input.pushFeishu,
        push_wecom: input.pushWecom,
      });
      return {
        date: result.date,
        sections: (result.sections ?? []).map((s) => ({
          platform: s.platform, label: s.label, source: s.source, degraded: s.degraded,
          failureCategory: s.failure_category ?? undefined,
          keywords: (s.keywords ?? []).map((k) => ({ word: k.word, heat: k.heat, rank: k.rank })),
        })),
        longtailWords: result.longtail_words ?? [],
        longtailError: result.longtail_error ?? undefined,
        markdown: result.markdown,
        pushes: (result.pushes ?? []).map((p) => ({
          channel: p.channel, ok: p.ok, latencyMs: p.latency_ms, error: p.error ?? undefined,
        })),
      };
    } finally {
      this.bump("keyword-trend", "idle").catch(console.error);
    }
  }

  // ── 生图 Skill 库 ──

  async getImageSkills(): Promise<ImageSkill[]> {
    return await getImageSkills();
  }

  async reversePrompt(input: { imageUrl: string; hint?: string }): Promise<ReversePromptResult> {
    const result = await this.mcp.call<{ prompt: string; style_tags: string[]; negative_prompt: string }>("image_prompt_reverse", {
      image_url: input.imageUrl,
      hint: input.hint,
    });
    return { prompt: result.prompt, styleTags: result.style_tags ?? [], negativePrompt: result.negative_prompt };
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
    const sb = getSupabase();
    await sb.from("wf_image_skills").delete().eq("id", id);
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
      const result = await this.mcp.call<{ images: Array<{ index: number; url: string }> }>("marketing_image_gen", {
        prompt,
        platform: "generic",
        style: "auto",
        aspect_ratio: skill.aspectRatio || "1:1",
        reference_image_url: skill.coverUrl || undefined,
        num_variants: 1,
      });
      await incrementImageSkillUsage(skill.id);
      return (result.images ?? []).map((img) => ({ index: img.index, url: img.url }));
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
    } catch { /* 非关键路径 */ }
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

export { ContentMCPError };
