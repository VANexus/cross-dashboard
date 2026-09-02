/**
 * FlowMind — TikHub 情报中心 Service
 *
 * 三个后端技能的前端编排层（零密钥，AI/抓取逻辑全在 flowmind）：
 *   tiktok_ad_intel      竞品广告创意库 / 行业字典 / 话题画像
 *   tiktok_shop_intel    TikTok Shop 选品 / 类目 / 详情 / 评论 / 商家
 *   tiktok_content_intel 热词 / 爆款视频 / 音乐榜 / 达人 / IG 话题帖子
 *
 * 后端返回 snake_case，这里统一映射为 camelCase 类型；degraded 空态原样透传（绝不补假数据）。
 */
import { ContentMCPClient, ContentMCPError } from "@/lib/content/mcp-client";
import type {
  AdIntelResult, AdMaterial, ContentIntelResult, CreatorInsight, CreatorProfile,
  IgPost, MusicItem, ShopIntelResult, ShopProduct, ShopProductDetail, ShopReview,
  VideoItem,
} from "@/lib/types";

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
  private mcp = new ContentMCPClient();

  // ── 广告情报 ──

  async searchAds(input: {
    keyword: string; period?: number; objective?: number; industry?: string;
    countryCode?: string; page?: number; limit?: number; orderBy?: string;
  }): Promise<AdIntelResult> {
    const raw = await this.mcp.call<Raw>("tiktok_ad_intel", {
      action: "search_ads",
      keyword: input.keyword,
      period: input.period ?? 180,
      objective: input.objective,
      industry: input.industry,
      country_code: input.countryCode ?? "US",
      page: input.page ?? 1,
      limit: input.limit ?? 20,
      order_by: input.orderBy ?? "for_you",
    }, { timeoutMs: 90_000, noRetry: true });
    return this.mapAd(raw, "search_ads");
  }

  async adFilters(): Promise<AdIntelResult> {
    const raw = await this.mcp.call<Raw>("tiktok_ad_intel", { action: "filters" }, { timeoutMs: 60_000 });
    return this.mapAd(raw, "filters");
  }

  async adLocations(): Promise<AdIntelResult> {
    const raw = await this.mcp.call<Raw>("tiktok_ad_intel", { action: "locations" }, { timeoutMs: 60_000 });
    return this.mapAd(raw, "locations");
  }

  async hashtagDetail(input: { hashtagId: string; timeRange?: number; countryCode?: string }): Promise<AdIntelResult> {
    const raw = await this.mcp.call<Raw>("tiktok_ad_intel", {
      action: "hashtag_detail",
      hashtag_id: input.hashtagId,
      time_range: input.timeRange ?? 30,
      country_code: input.countryCode ?? "US",
    }, { timeoutMs: 60_000 });
    return this.mapAd(raw, "hashtag_detail");
  }

  private mapAd(raw: Raw, action: string): AdIntelResult {
    const materials: AdMaterial[] = arr<Raw>(raw.materials).map((m) => ({
      id: str(m.id), rank: Number(m.rank ?? 0), title: str(m.title), brand: str(m.brand),
      ctr: num(m.ctr), likes: num(m.likes), cost: num(m.cost), objective: str(m.objective),
      industryKey: str(m.industry_key), isSearch: bool(m.is_search),
      durationS: num(m.duration_s), coverUrl: str(m.cover_url), videoUrl: str(m.video_url),
      width: num(m.width), height: num(m.height),
    }));
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
    const raw = await this.mcp.call<Raw>("tiktok_shop_intel", {
      action: "search", keyword: input.keyword, region: input.region ?? "US",
      limit: input.limit ?? 20, offset: input.offset ?? 0,
    }, { timeoutMs: 90_000, noRetry: true });
    return this.mapShop(raw, "search");
  }

  async searchSuggest(input: { keyword: string; region?: string }): Promise<ShopIntelResult> {
    const raw = await this.mcp.call<Raw>("tiktok_shop_intel", {
      action: "suggest", keyword: input.keyword, region: input.region ?? "US",
    }, { timeoutMs: 60_000 });
    return this.mapShop(raw, "suggest");
  }

  async shopCategories(region = "US"): Promise<ShopIntelResult> {
    const raw = await this.mcp.call<Raw>("tiktok_shop_intel", { action: "categories", region }, { timeoutMs: 60_000 });
    return this.mapShop(raw, "categories");
  }

  async productDetail(input: { productId: string; region?: string }): Promise<ShopIntelResult> {
    const raw = await this.mcp.call<Raw>("tiktok_shop_intel", {
      action: "detail", product_id: input.productId, region: input.region ?? "US",
    }, { timeoutMs: 60_000 });
    return this.mapShop(raw, "detail");
  }

  async productReviews(input: { productId: string; region?: string; page?: number; limit?: number }): Promise<ShopIntelResult> {
    const raw = await this.mcp.call<Raw>("tiktok_shop_intel", {
      action: "reviews", product_id: input.productId, region: input.region ?? "US",
      page: input.page ?? 1, limit: input.limit ?? 20,
    }, { timeoutMs: 60_000 });
    return this.mapShop(raw, "reviews");
  }

  async sellerProducts(input: { sellerId: string; region?: string; limit?: number }): Promise<ShopIntelResult> {
    const raw = await this.mcp.call<Raw>("tiktok_shop_intel", {
      action: "seller", seller_id: input.sellerId, region: input.region ?? "US", limit: input.limit ?? 20,
    }, { timeoutMs: 60_000 });
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
    const raw = await this.mcp.call<Raw>("tiktok_content_intel", { action: "trending_words", limit }, { timeoutMs: 60_000 });
    return this.mapContent(raw, "trending_words");
  }

  async videoSearch(input: { keyword: string; limit?: number; region?: string }): Promise<ContentIntelResult> {
    const raw = await this.mcp.call<Raw>("tiktok_content_intel", {
      action: "video_search", keyword: input.keyword, limit: input.limit ?? 20, region: input.region ?? "US",
    }, { timeoutMs: 90_000, noRetry: true });
    return this.mapContent(raw, "video_search");
  }

  async musicChart(limit = 20): Promise<ContentIntelResult> {
    const raw = await this.mcp.call<Raw>("tiktok_content_intel", { action: "music_chart", limit }, { timeoutMs: 60_000 });
    return this.mapContent(raw, "music_chart");
  }

  async creatorInsights(limit = 20): Promise<ContentIntelResult> {
    const raw = await this.mcp.call<Raw>("tiktok_content_intel", { action: "creator_insights", limit }, { timeoutMs: 60_000 });
    return this.mapContent(raw, "creator_insights");
  }

  async creatorProfile(input: { uniqueId: string; withCountry?: boolean }): Promise<ContentIntelResult> {
    const raw = await this.mcp.call<Raw>("tiktok_content_intel", {
      action: "creator_profile", unique_id: input.uniqueId, with_country: input.withCountry ?? true,
    }, { timeoutMs: 60_000 });
    return this.mapContent(raw, "creator_profile");
  }

  async igHashtagPosts(input: { keyword: string; feedType?: string; limit?: number }): Promise<ContentIntelResult> {
    const raw = await this.mcp.call<Raw>("tiktok_content_intel", {
      action: "ig_hashtag_posts", keyword: input.keyword,
      feed_type: input.feedType ?? "top", limit: input.limit ?? 20,
    }, { timeoutMs: 90_000, noRetry: true });
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

export { ContentMCPError };
