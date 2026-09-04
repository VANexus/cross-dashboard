/**
 * FlowMind — TikHub 情报中心 Service
 *
 * 三个情报技能的前端编排层（已自举：TikHub REST 直连，无后端依赖）：
 *   tiktok_ad_intel      竞品广告创意库 / 行业字典 / 话题画像
 *   tiktok_shop_intel    TikTok Shop 选品 / 类目 / 详情 / 评论 / 商家
 *   tiktok_content_intel 热词 / 爆款视频 / 音乐榜 / 达人 / IG 话题帖子
 *
 * 数据源为 TikHub REST（AI_TRENDS_API_KEY / AI_TRENDS_API_BASE），
 * selfhost 层返回与后端 skill 同构的 snake_case Raw，这里统一映射为 camelCase
 * 类型；degraded 空态原样透传（绝不补假数据）。
 */
import { IntelSelfhostService } from "@/lib/server/services/tikhub-intel.selfhost";
import type {
  AdIntelResult, AdMaterial, ContentIntelResult, CreatorInsight, CreatorProfile,
  IgPost, MusicItem, ShopIntelResult, ShopProduct, ShopProductDetail, ShopReview,
  VideoItem,
} from "@/lib/shared/types";

type Raw = Record<string, unknown>;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}
function bool(v: unknown): boolean {
  return Boolean(v);
}
function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
/** 评论时间：后端给的是 epoch（毫秒为主，兼容秒），统一成 YYYY-MM-DD；非数字原样返回。 */
function fmtDate(v: unknown): string {
  const raw = str(v).trim();
  if (!/^\d+$/.test(raw)) return raw;
  let ms = Number(raw);
  if (ms < 1e12) ms *= 1000; // 秒级时间戳
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return raw;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 透传共用降级信封字段。 */
function envelope(raw: Raw) {
  return {
    source: str(raw.source) || "tikhub",
    degraded: bool(raw.degraded),
    failureCategory: (raw.failure_category as string | null) ?? null,
    retriable: bool(raw.retriable),
    warning: (raw.warning as string | null) ?? null,
  };
}

export class IntelService {
  private selfhost = new IntelSelfhostService();

  // ── 广告情报 ──

  async searchAds(input: {
    keyword: string; period?: number; objective?: number; industry?: string;
    countryCode?: string; page?: number; limit?: number; orderBy?: string;
  }): Promise<AdIntelResult> {
    const raw = await this.selfhost.searchAds({
      keyword: input.keyword,
      period: input.period,
      objective: input.objective,
      industry: input.industry,
      countryCode: input.countryCode,
      page: input.page,
      limit: input.limit,
      orderBy: input.orderBy,
    });
    return await this.mapAd(raw, "search_ads");
  }

  async adFilters(): Promise<AdIntelResult> {
    const raw = await this.selfhost.adFilters();
    return await this.mapAd(raw, "filters");
  }

  async adLocations(): Promise<AdIntelResult> {
    const raw = await this.selfhost.adLocations();
    return await this.mapAd(raw, "locations");
  }

  async hashtagDetail(input: { hashtagId: string; timeRange?: number; countryCode?: string }): Promise<AdIntelResult> {
    const raw = await this.selfhost.hashtagDetail({
      hashtagId: input.hashtagId,
      timeRange: input.timeRange,
      countryCode: input.countryCode,
    });
    return await this.mapAd(raw, "hashtag_detail");
  }

  private async mapAd(raw: Raw, action: string): Promise<AdIntelResult> {
    const materials: AdMaterial[] = arr<Raw>(raw.materials).map((m) => ({
      id: str(m.id), rank: Number(m.rank ?? 0), title: str(m.title), brand: str(m.brand),
      ctr: num(m.ctr), likes: num(m.likes), cost: num(m.cost), objective: str(m.objective),
      industryKey: str(m.industry_key), isSearch: bool(m.is_search),
      durationS: num(m.duration_s), coverUrl: str(m.cover_url), videoUrl: str(m.video_url),
      width: num(m.width), height: num(m.height),
    }));
    // 品牌补全：TikHub 素材常缺 brand_name → 用云 LLM 从广告标题批量推测品牌（失败静默，保留空值）
    await enrichUnknownBrands(materials);
    const filtersIn = (raw.filters ?? {}) as Raw;
    const filters: AdIntelResult["filters"] = {};
    for (const [k, col] of Object.entries(filtersIn)) {
      filters[k] = arr<Raw>(col).map((x) => ({
        id: str(x.id), label: str(x.label), parentId: num(x.parent_id),
      }));
    }
    const hd = (raw.hashtag_detail ?? {}) as Raw;
    const pg = (raw.pagination ?? {}) as Raw;
    return {
      ...envelope(raw), action, materials,
      pagination: {
        hasMore: bool(pg.has_more), page: num(pg.page) ?? undefined,
        total: num(pg.total) ?? undefined, size: num(pg.page_size) ?? num(pg.size) ?? undefined,
      },
      filters,
      locations: arr<Raw>(raw.locations).map((l) => ({ id: str(l.id), name: str(l.name) })),
      hashtagDetail: {
        hashtagId: str(hd.hashtag_id), name: str(hd.name), vv: num(hd.vv),
        publishCnt: num(hd.publish_cnt), timeRange: num(hd.time_range),
        curve: arr<Raw>(hd.curve).map((p) => ({ timestamp: str(p.timestamp), value: Number(p.value ?? 0) })),
        ageProfile: arr<Raw>(hd.age_profile).map((a) => ({ level: str(a.level), percent: num(a.percent) })),
        countryProfile: arr<Raw>(hd.country_profile).map((g) => ({ country: str(g.country), tgi: num(g.tgi) })),
        videos: arr<Raw>(hd.videos).map((v) => ({
          itemId: str(v.item_id), coverUrl: str(v.cover_url), videoUrl: str(v.video_url),
        })),
      },
    };
  }

  // ── 选品情报 ──

  async searchProducts(input: { keyword: string; region?: string; limit?: number; offset?: number }): Promise<ShopIntelResult> {
    const raw = await this.selfhost.searchProducts({
      keyword: input.keyword, region: input.region, limit: input.limit, offset: input.offset,
    });
    return this.mapShop(raw, "search");
  }

  async searchSuggest(input: { keyword: string; region?: string }): Promise<ShopIntelResult> {
    const raw = await this.selfhost.searchSuggest({ keyword: input.keyword, region: input.region });
    return this.mapShop(raw, "suggest");
  }

  async shopCategories(region = "US"): Promise<ShopIntelResult> {
    const raw = await this.selfhost.shopCategories(region);
    return this.mapShop(raw, "categories");
  }

  async productDetail(input: { productId: string; region?: string }): Promise<ShopIntelResult> {
    const raw = await this.selfhost.productDetail({ productId: input.productId, region: input.region });
    return this.mapShop(raw, "detail");
  }

  async productReviews(input: { productId: string; region?: string; page?: number; limit?: number }): Promise<ShopIntelResult> {
    const raw = await this.selfhost.productReviews({
      productId: input.productId, region: input.region, page: input.page, limit: input.limit,
    });
    return this.mapShop(raw, "reviews");
  }

  async sellerProducts(input: { sellerId: string; region?: string; limit?: number }): Promise<ShopIntelResult> {
    const raw = await this.selfhost.sellerProducts({ sellerId: input.sellerId, region: input.region, limit: input.limit });
    return this.mapShop(raw, "seller");
  }

  private mapProduct(p: Raw): ShopProduct {
    return {
      productId: str(p.product_id), title: str(p.title), imageUrl: str(p.image_url),
      price: str(p.price), originalPrice: str(p.original_price), discount: str(p.discount),
      currency: str(p.currency), rating: num(p.rating), reviewCount: num(p.review_count),
      soldCount: num(p.sold_count), sellerId: str(p.seller_id), sellerName: str(p.seller_name),
      brand: str(p.brand), url: str(p.url), labels: arr<string>(p.labels).map(String),
    };
  }

  private mapShop(raw: Raw, action: string): ShopIntelResult {
    const detailIn = (raw.detail ?? {}) as Raw;
    const shopIn = (detailIn.shop ?? {}) as Raw;
    const detail: ShopProductDetail = {
      productId: str(detailIn.product_id), sellerId: str(detailIn.seller_id),
      name: str(detailIn.name), soldCount: num(detailIn.sold_count),
      images: arr<string>(detailIn.images).map(String),
      descImages: arr<string>(detailIn.desc_images).map(String),
      specs: arr<Raw>(detailIn.specs).map((s) => ({ name: str(s.name), values: arr<string>(s.values).map(String) })),
      variants: arr<Raw>(detailIn.variants).map((s) => ({ name: str(s.name), values: arr<string>(s.values).map(String) })),
      skuCount: Number(detailIn.sku_count ?? 0),
      videoUrls: arr<string>(detailIn.video_urls).map(String),
      shop: {
        sellerId: str(shopIn.seller_id), shopName: str(shopIn.shop_name),
        shopRating: num(shopIn.shop_rating), reviewCount: num(shopIn.review_count),
        followers: num(shopIn.followers), shopSold: num(shopIn.shop_sold),
        onSellCount: num(shopIn.on_sell_count),
      },
    };
    const rs = (raw.review_summary ?? {}) as Raw;
    const pg = (raw.page ?? {}) as Raw;
    return {
      ...envelope(raw), action,
      products: arr<Raw>(raw.products).map((p) => this.mapProduct(p)),
      page: {
        hasMore: bool(pg.has_more), offset: num(pg.offset) ?? undefined,
        pageToken: str(pg.page_token), size: num(pg.size) ?? undefined,
      },
      suggestions: arr<string>(raw.suggestions).map(String),
      categories: arr<Raw>(raw.categories).map(function mapCat(c): ShopIntelResult["categories"][number] {
        return {
          categoryId: str(c.category_id), name: str(c.name), level: num(c.category_level ?? c.level),
          isLeaf: bool(c.is_leaf), children: arr<Raw>(c.children).map(mapCat),
        };
      }),
      detail,
      reviews: arr<Raw>(raw.reviews).map((r): ShopReview => ({
        reviewId: str(r.review_id), rating: num(r.rating), time: fmtDate(r.time),
        verified: bool(r.verified), incentivized: bool(r.incentivized),
        reviewer: str(r.reviewer), text: str(r.text),
        images: arr<string>(r.images).map(String), skuSpec: str(r.sku_spec), country: str(r.country),
      })),
      reviewSummary: {
        total: str(rs.total), avg: num(rs.avg), hasMore: bool(rs.has_more),
        distribution: (rs.distribution ?? {}) as Record<string, string>,
      },
    };
  }

  // ── 内容 / 达人情报 ──

  async trendingWords(limit = 30): Promise<ContentIntelResult> {
    const raw = await this.selfhost.trendingWords(limit);
    return this.mapContent(raw, "trending_words");
  }

  async videoSearch(input: { keyword: string; limit?: number; region?: string }): Promise<ContentIntelResult> {
    const raw = await this.selfhost.videoSearch({ keyword: input.keyword, limit: input.limit, region: input.region });
    return this.mapContent(raw, "video_search");
  }

  async musicChart(limit = 20): Promise<ContentIntelResult> {
    const raw = await this.selfhost.musicChart(limit);
    return this.mapContent(raw, "music_chart");
  }

  async creatorInsights(limit = 20): Promise<ContentIntelResult> {
    const raw = await this.selfhost.creatorInsights(limit);
    return this.mapContent(raw, "creator_insights");
  }

  async creatorProfile(input: { uniqueId: string; withCountry?: boolean }): Promise<ContentIntelResult> {
    const raw = await this.selfhost.creatorProfile({ uniqueId: input.uniqueId, withCountry: input.withCountry });
    return this.mapContent(raw, "creator_profile");
  }

  async igHashtagPosts(input: { keyword: string; feedType?: string; limit?: number }): Promise<ContentIntelResult> {
    const raw = await this.selfhost.igHashtagPosts({
      keyword: input.keyword, feedType: input.feedType, limit: input.limit,
    });
    return this.mapContent(raw, "ig_hashtag_posts");
  }

  private mapContent(raw: Raw, action: string): ContentIntelResult {
    const videos: VideoItem[] = arr<Raw>(raw.videos).map((v) => ({
      awemeId: str(v.aweme_id), desc: str(v.desc), createTime: num(v.create_time), durationS: num(v.duration_s),
      play: num(v.play), likes: num(v.likes), comments: num(v.comments), shares: num(v.shares),
      collects: num(v.collects), authorId: str(v.author_id), author: str(v.author),
      authorHandle: str(v.author_handle), authorFollowers: num(v.author_followers),
      coverUrl: str(v.cover_url), videoUrl: str(v.video_url), musicTitle: str(v.music_title),
    }));
    const music: MusicItem[] = arr<Raw>(raw.music).map((m) => ({
      rank: Number(m.rank ?? 0), musicId: str(m.music_id), title: str(m.title), author: str(m.author),
      durationS: num(m.duration_s), userCount: num(m.user_count), trend: num(m.trend),
      coverUrl: str(m.cover_url), artists: arr<string>(m.artists).map(String),
    }));
    const insights: CreatorInsight[] = arr<Raw>(raw.insights).map((i) => ({
      queryId: str(i.query_id), query: str(i.query), popularity: num(i.popularity),
      popularityV2: num(i.popularity_v2), videoNum: num(i.video_num),
      trendSeq: arr<number>(i.trend_seq).map(Number),
      categoryL1: str(i.category_l1), categoryL2: str(i.category_l2),
      businessTypes: arr<string>(i.business_types).map(String),
    }));
    const igPosts: IgPost[] = arr<Raw>(raw.ig_posts).map((p) => ({
      mediaId: str(p.media_id), code: str(p.code), caption: str(p.caption),
      hashtags: arr<string>(p.hashtags).map(String), likes: num(p.likes), comments: num(p.comments),
      plays: num(p.plays), isVideo: bool(p.is_video), mediaType: num(p.media_type),
      thumbnail: str(p.thumbnail), videoUrl: str(p.video_url), takenAt: num(p.taken_at),
      username: str(p.username), userFullname: str(p.user_fullname), verified: bool(p.verified),
    }));
    return {
      ...envelope(raw), action,
      trendingWords: arr<Raw>(raw.trending_words).map((w) => ({ word: str(w.word), type: str(w.type) })),
      videos, music, insights,
      profile: this.mapProfile((raw.profile ?? {}) as Raw),
      igPosts, igPaginationToken: str(raw.ig_pagination_token),
    };
  }

  private mapProfile(p: Raw): CreatorProfile {
    return {
      userId: str(p.user_id), secUserId: str(p.sec_user_id), uniqueId: str(p.unique_id),
      nickname: str(p.nickname), followers: num(p.followers) ?? 0, following: num(p.following) ?? 0,
      awemeCount: num(p.aweme_count) ?? 0, signature: str(p.signature), customVerify: str(p.custom_verify),
      isStar: bool(p.is_star), avatarUrl: str(p.avatar_url), country: str(p.country),
    };
  }
}

// ── 广告品牌推测（云 LLM 批量识别，AI 广告 / 竞品广告共用）───────────────

const BRAND_ENRICH_LIMIT = 30; // 单次最多补全条数（控制延迟）

/**
 * 对 brand 为空且 title 非空的广告素材，用云 LLM（AI_LLM_* 网关）从标题/文案
 * 批量推测品牌。只做「推测标注」，失败或无法判断时静默保留原值（绝不编造）。
 * 结果直接写回 materials（原地替换对象），无返回。
 */
async function enrichUnknownBrands(materials: AdMaterial[]): Promise<void> {
  const blankIdx: number[] = [];
  for (let i = 0; i < materials.length; i++) {
    const m = materials[i];
    if (!m.brand?.trim() && m.title?.trim()) blankIdx.push(i);
  }
  if (blankIdx.length === 0) return;
  const targets = blankIdx.slice(0, BRAND_ENRICH_LIMIT);
  const titles = targets.map((i) => materials[i].title ?? "");

  const apiKey = process.env.AI_LLM_API_KEY?.trim();
  const baseUrl = process.env.AI_LLM_BASE_URL?.trim();
  if (!apiKey || !baseUrl) return; // 模型网关未配置 → 保留原始 brand
  const base = baseUrl.replace(/\/+$/, "");

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(`${base.endsWith("/v1") ? base : `${base}/v1`}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: process.env.AI_LLM_MODEL?.trim() || "deepseek-ai/DeepSeek-V3",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "你是跨境电商广告品牌识别专家。根据广告标题/文案推测该广告属于哪个品牌。" +
              "只返回 JSON 对象：键为数组下标（字符串数字），值为品牌英文名（用品牌官方/常见写法，保留大小写）；" +
              "无法判断的品牌给空字符串。只依据标题文案里出现的品牌线索推断，不要凭猜测编造知名品牌。" +
              "如果标题是通用商品词（如“waterproof backpack sale”）且无明显品牌，返回空字符串。",
          },
          { role: "user", content: JSON.stringify(titles) },
        ],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return;
    const parsed = JSON.parse(
      content.replace(/```json|```/g, "").trim().replace(/^[^{]*/, "").replace(/[^}]*$/, ""),
    ) as Record<string, unknown>;
    for (const [k, v] of Object.entries(parsed)) {
      const offset = Number(k);
      if (!Number.isInteger(offset) || !targets[offset]) continue;
      const brand = typeof v === "string" ? v.trim() : "";
      if (!brand || brand === "-") continue;
      const realIdx = targets[offset];
      materials[realIdx] = { ...materials[realIdx], brand };
    }
  } catch {
    /* 补全失败静默：保留空品牌，前端展示「品牌未知」 */
  }
}
