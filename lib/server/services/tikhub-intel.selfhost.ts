/**
 * lib/server/services/tikhub-intel.selfhost.ts — TikHub 情报中心三技能 自举 Provider 层
 *
 * 把原本走 flowmind MCP（tiktok_ad_intel / tiktok_shop_intel / tiktok_content_intel）
 * 的三个情报技能，直接在 Next.js 全栈进程内直连 TikHub REST 实现：
 *
 *  - tiktok_ad_intel      → /api/v1/tiktok/ads/*  + /api/v1/tiktok/web/*
 *  - tiktok_shop_intel    → /api/v1/tiktok/shop/web/*
 *  - tiktok_content_intel → /api/v1/tiktok/app/v3/* + /api/v1/instagram/v2/*
 *
 * 返回结构与后端 skill 输出完全同构（snake_case 业务字段 + source/degraded/
 * failure_category/retriable/warning 信封），使 intel.service.ts 的 camelCase
 * 映射层零改动。错误契约对齐 SelfhostError（category/retriable）。
 * 密钥只从 env 读取（AI_TRENDS_API_KEY / AI_TRENDS_API_BASE），不落库、不落前端。
 */
import { SelfhostError } from "@/lib/server/services/b2b.selfhost";

// ── TikHub 请求封装（Bearer + 信封解平 + 错误分类）────────────────

const TIKHUB_DEFAULT_BASE = "https://api.tikhub.dev";

interface TikHubEnvelope<T = unknown> {
  code?: number;
  message?: string;
  message_zh?: string;
  msg?: string;
  data?: T;
}

/** 很多 TikHub 端点在统一信封 data 内再包一层 {code,message/msg,data}：存在内层时解平。 */
function innerData(data: unknown): unknown {
  if (data && typeof data === "object" && "data" in (data as Record<string, unknown>)) {
    const d = data as Record<string, unknown>;
    if ("code" in d || "msg" in d || "message" in d) {
      const inner = d.data;
      return inner !== null && inner !== undefined ? inner : d;
    }
  }
  return data;
}

class TikHubIntelClient {
  private readonly base: string;
  private readonly key: string;

  constructor() {
    this.base = (process.env.AI_TRENDS_API_BASE ?? TIKHUB_DEFAULT_BASE).replace(/\/+$/, "");
    this.key = process.env.AI_TRENDS_API_KEY?.trim() ?? "";
  }

  private async request<T = unknown>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    if (!this.key) {
      throw new SelfhostError("environment", "未配置 AI_TRENDS_API_KEY（父目录 .env 已预置 TikHub key，请确认部署时注入）。");
    }
    const url = `${this.base}${path}`;
    let resp: Response;
    try {
      resp = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: method === "POST" && body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      throw new SelfhostError("timeout", `TikHub 情报接口网络异常：${err instanceof Error ? err.message : "未知"}`);
    }

    if (resp.status === 401 || resp.status === 403) {
      throw new SelfhostError("environment", `TikHub 情报鉴权失败（HTTP ${resp.status}），请检查 AI_TRENDS_API_KEY。`);
    }
    if (resp.status === 402 || resp.status === 429) {
      throw new SelfhostError("environment", `TikHub 额度不足或限流（HTTP ${resp.status}），请稍后重试或充值。`);
    }
    if (resp.status >= 500) {
      throw new SelfhostError("timeout", `TikHub 服务暂不可用（HTTP ${resp.status}）。`);
    }
    if (resp.status === 404 || resp.status === 422) {
      throw new SelfhostError("unknown", `TikHub 接口参数错误（HTTP ${resp.status}）。`);
    }

    let raw: TikHubEnvelope<T>;
    try {
      raw = (await resp.json()) as TikHubEnvelope<T>;
    } catch {
      throw new SelfhostError("unknown", `TikHub 返回非 JSON（HTTP ${resp.status}）。`);
    }
    const code = raw.code ?? 200;
    if (code !== 200 && code !== 0) {
      const msg = raw.message_zh || raw.message || raw.msg || `业务错误码 ${code}`;
      throw new SelfhostError("unknown", `TikHub 业务错误：${msg}`);
    }
    return raw.data as T;
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async get<T = unknown>(path: string, params: Record<string, unknown>): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      qs.set(k, String(v));
    }
    const q = qs.toString();
    return this.request<T>("GET", `${path}${q ? `?${q}` : ""}`);
  }
}

// ── 解析纯函数（对齐后端 _tikhub_intel_parse.py，真实字段，绝不补假值）──

type AnyDict = Record<string, unknown>;

function toInt(v: unknown, def = 0): number | null {
  if (v === null || v === undefined || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}
function toFloat(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function firstUrl(node: unknown): string {
  if (typeof node === "string") return node;
  if (node && typeof node === "object") {
    const n = node as AnyDict;
    const urls = n.url_list;
    if (Array.isArray(urls) && urls.length) return String(urls[0]);
    for (const k of ["url", "uri"]) {
      if (n[k]) return String(n[k]);
    }
  }
  return "";
}

// ── Ads ──

function parseAdMaterials(data: unknown): AnyDict[] {
  if (!data || typeof data !== "object") return [];
  const raw = (data as AnyDict).materials;
  if (!Array.isArray(raw)) return [];
  const rows: AnyDict[] = [];
  raw.forEach((m, i) => {
    if (!m || typeof m !== "object") return;
    const md = m as AnyDict;
    const vi = (md.video_info && typeof md.video_info === "object" ? md.video_info : {}) as AnyDict;
    const vu = (vi.video_url && typeof vi.video_url === "object" ? vi.video_url : {}) as AnyDict;
    rows.push({
      id: String(md.id ?? ""),
      rank: i + 1,
      title: String(md.ad_title ?? "").trim(),
      brand: String(md.brand_name ?? "").trim(),
      ctr: typeof md.ctr === "number" ? md.ctr : null,
      likes: toInt(md.like),
      cost: toInt(md.cost),
      objective: String(md.objective_key ?? ""),
      industry_key: String(md.industry_key ?? ""),
      is_search: Boolean(md.is_search),
      duration_s: typeof vi.duration === "number" ? vi.duration : null,
      cover_url: String(vi.cover ?? ""),
      video_url: String(vu["720p"] || vu.default || ""),
      width: toInt(vi.width),
      height: toInt(vi.height),
    });
  });
  return rows;
}

function parseAdPagination(data: unknown): AnyDict {
  const pg = data && typeof data === "object" ? ((data as AnyDict).pagination as AnyDict | undefined) : undefined;
  if (!pg || typeof pg !== "object") return { has_more: false, page: 1, total: 0 };
  return {
    has_more: Boolean(pg.has_more ?? pg.hasMore),
    page: toInt(pg.page, 1) ?? 1,
    total: toInt(pg.total_count ?? pg.totalCount, 0) ?? 0,
  };
}

function parseAdFilters(data: unknown): AnyDict {
  if (!data || typeof data !== "object") return {};
  const d = data as AnyDict;
  const out: AnyDict = {};
  for (const key of ["industry", "objective", "ad_language", "pattern_label", "period", "country"]) {
    const col = d[key];
    if (!Array.isArray(col)) continue;
    out[key] = col
      .filter((x): x is AnyDict => !!x && typeof x === "object")
      .map((x) => ({
        id: x.id !== null && x.id !== undefined ? String(x.id) : "",
        label: String(x.value ?? x.label ?? ""),
        parent_id: x.parent_id !== null && x.parent_id !== undefined ? toInt(x.parent_id) : null,
      }));
  }
  return out;
}

function parseLocations(data: unknown): AnyDict[] {
  if (!data || typeof data !== "object") return [];
  const col = (data as AnyDict).country;
  if (!Array.isArray(col)) return [];
  return col
    .filter((x): x is AnyDict => !!x && typeof x === "object")
    .map((x) => ({ id: String(x.id ?? ""), name: String(x.value ?? x.label ?? "") }));
}

function parseHashtagDetail(data: unknown): AnyDict {
  if (!data || typeof data !== "object") return {};
  const d = data as AnyDict;
  const curve = Array.isArray(d.popularityCurve)
    ? d.popularityCurve.filter((p): p is AnyDict => !!p && typeof p === "object")
        .map((p) => ({ timestamp: String(p.timestamp ?? ""), value: Number(p.value ?? 0) }))
    : [];
  const age = Array.isArray(d.ageProfile)
    ? d.ageProfile.filter((a): a is AnyDict => !!a && typeof a === "object")
        .map((a) => ({ level: String(a.ageLevel ?? ""), percent: toFloat(a.vvPercent) }))
    : [];
  const geo = Array.isArray(d.representativeCountryProfile)
    ? d.representativeCountryProfile.filter((g): g is AnyDict => !!g && typeof g === "object")
        .map((g) => ({ country: String(g.countryCode ?? ""), tgi: toFloat(g.countryTgiScore) }))
    : [];
  const videos = Array.isArray(d.videoList)
    ? d.videoList.filter((v): v is AnyDict => !!v && typeof v === "object")
        .map((v) => {
          const vu = (v.videoURL && typeof v.videoURL === "object" ? v.videoURL : {}) as AnyDict;
          return { item_id: String(v.itemID ?? ""), cover_url: String(v.coverURL ?? ""), video_url: String(vu.default ?? "") };
        })
    : [];
  return {
    hashtag_id: String(d.hashtagID ?? ""),
    name: String(d.hashtagName ?? ""),
    vv: toInt(d.vv),
    publish_cnt: toInt(d.publishCnt),
    time_range: toInt(d.timeRange),
    country: String(d.countryCode ?? ""),
    industry_ids: Array.isArray(d.industryIDs) ? d.industryIDs.map((x) => toInt(x)).filter((x): x is number => x !== null) : [],
    curve,
    age_profile: age,
    country_profile: geo,
    videos,
  };
}

// ── Content / 达人 ──

function parseTrendingSearchwords(data: unknown): AnyDict[] {
  if (!data || typeof data !== "object") return [];
  const raw = (data as AnyDict).trending_search_words;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is AnyDict => !!x && typeof x === "object" && Boolean(String((x as AnyDict).trendingSearchWord ?? "").trim()))
    .map((x) => ({ word: String(x.trendingSearchWord ?? "").trim(), type: String(x.trendingSearchWordType ?? "") }));
}

function parseVideoSearch(data: unknown): AnyDict[] {
  if (!data || typeof data !== "object") return [];
  const raw = (data as AnyDict).search_item_list;
  if (!Array.isArray(raw)) return [];
  const rows: AnyDict[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const a = (item as AnyDict).aweme_info as AnyDict | undefined;
    if (!a || typeof a !== "object") continue;
    const st = (a.statistics && typeof a.statistics === "object" ? a.statistics : {}) as AnyDict;
    const author = (a.author && typeof a.author === "object" ? a.author : {}) as AnyDict;
    const video = (a.video && typeof a.video === "object" ? a.video : {}) as AnyDict;
    const nw = (video.download_no_watermark_addr as AnyDict | undefined) ?? (video.download_addr as AnyDict | undefined) ?? {};
    const music = (a.music && typeof a.music === "object" ? a.music : {}) as AnyDict;
    const durMs = toInt(video.duration);
    rows.push({
      aweme_id: String(a.aweme_id ?? ""),
      desc: String(a.desc ?? "").trim(),
      create_time: toInt(a.create_time),
      duration_s: durMs ? Math.round(durMs / 100) / 10 : null,
      play: toInt(st.play_count),
      likes: toInt(st.digg_count),
      comments: toInt(st.comment_count),
      shares: toInt(st.share_count),
      collects: toInt(st.collect_count),
      author_id: String(author.uid ?? author.unique_id ?? ""),
      author: String(author.nickname ?? author.unique_id ?? ""),
      author_handle: String(author.unique_id ?? ""),
      author_followers: toInt(author.follower_count),
      cover_url: firstUrl(video.cover) || firstUrl(video.origin_cover),
      video_url: firstUrl(nw),
      music_title: String(music.title ?? ""),
    });
  }
  return rows;
}

function parseMusicChart(data: unknown): AnyDict[] {
  if (!data || typeof data !== "object") return [];
  const raw = (data as AnyDict).music_list;
  if (!Array.isArray(raw)) return [];
  const rows: AnyDict[] = [];
  raw.forEach((m, i) => {
    if (!m || typeof m !== "object") return;
    const md = m as AnyDict;
    const mi = (md.music_info && typeof md.music_info === "object" ? md.music_info : {}) as AnyDict;
    const artists = Array.isArray(mi.artists) ? mi.artists.filter((x): x is AnyDict => !!x && typeof x === "object") : [];
    rows.push({
      rank: i + 1,
      music_id: String(md.id ?? mi.id_str ?? mi.id ?? ""),
      title: String(mi.title ?? "").trim(),
      author: String(mi.author ?? "").trim(),
      duration_s: toInt(mi.duration),
      user_count: toInt(mi.user_count),
      trend: toInt(md.trend),
      cover_url: firstUrl(mi.cover_large) || firstUrl(mi.cover_medium),
      artists: artists.map((x) => String(x.nick_name ?? x.handle ?? "")),
    });
  });
  return rows;
}

function parseCreatorInsights(data: unknown): AnyDict[] {
  if (!data || typeof data !== "object") return [];
  const raw = (data as AnyDict).inspiration_list;
  if (!Array.isArray(raw)) return [];
  const rows: AnyDict[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const xd = x as AnyDict;
    const textnet = (xd.textnet && typeof xd.textnet === "object" ? xd.textnet : {}) as AnyDict;
    const seq = Array.isArray(xd.trending_seq) ? xd.trending_seq.map((v) => toInt(v)).filter((v): v is number => v !== null) : [];
    rows.push({
      query_id: String(xd.query_id_str ?? xd.query_id ?? ""),
      query: String(xd.query_text ?? "").trim(),
      popularity: toInt(xd.popularity),
      popularity_v2: toInt(xd.popularity_v2),
      video_num: toInt(xd.video_num),
      trend_seq: seq,
      category_l1: String(textnet.layer1 ?? ""),
      category_l2: String(textnet.layer2 ?? ""),
      business_types: Array.isArray(xd.business_types) ? xd.business_types.map((b) => String(b)).filter(Boolean) : [],
    });
  }
  return rows;
}

function parseUserProfile(data: unknown): AnyDict {
  if (!data || typeof data !== "object") return {};
  const u = (data as AnyDict).user as AnyDict | undefined;
  if (!u || typeof u !== "object") return {};
  return {
    user_id: String(u.uid ?? u.id ?? ""),
    sec_user_id: String(u.sec_uid ?? ""),
    unique_id: String(u.unique_id ?? ""),
    nickname: String(u.nickname ?? ""),
    followers: toInt(u.follower_count),
    following: toInt(u.following_count),
    aweme_count: toInt(u.aweme_count),
    favoriting_count: toInt(u.favoriting_count),
    signature: String(u.signature ?? ""),
    custom_verify: String(u.custom_verify ?? ""),
    is_star: Boolean(u.is_star),
    avatar_url: firstUrl(u.avatar_larger) || firstUrl(u.avatar_medium),
  };
}

// ── Shop ──

function parseShopProducts(data: unknown): AnyDict[] {
  if (!data || typeof data !== "object") return [];
  const raw = (data as AnyDict).products;
  if (!Array.isArray(raw)) return [];
  const rows: AnyDict[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const pd = p as AnyDict;
    const price = (pd.product_price_info && typeof pd.product_price_info === "object" ? pd.product_price_info : {}) as AnyDict;
    const rate = (pd.rate_info && typeof pd.rate_info === "object" ? pd.rate_info : {}) as AnyDict;
    const sold = (pd.sold_info && typeof pd.sold_info === "object" ? pd.sold_info : {}) as AnyDict;
    const seller = (pd.seller_info && typeof pd.seller_info === "object" ? pd.seller_info : {}) as AnyDict;
    const brand = (pd.brand_info && typeof pd.brand_info === "object" ? pd.brand_info : {}) as AnyDict;
    const seo = (pd.seo_url && typeof pd.seo_url === "object" ? pd.seo_url : {}) as AnyDict;
    const labels: string[] = [];
    const pmi = pd.product_marketing_info;
    if (pmi && typeof pmi === "object") {
      const placement = (pmi as AnyDict).placement_labels;
      if (placement && typeof placement === "object") {
        for (const labList of Object.values(placement as AnyDict)) {
          if (Array.isArray(labList)) {
            for (const lab of labList) {
              if (lab && typeof lab === "object" && (lab as AnyDict).text) labels.push(String((lab as AnyDict).text));
            }
          }
        }
      }
    }
    rows.push({
      product_id: String(pd.product_id ?? ""),
      title: String(pd.title ?? "").trim(),
      image_url: firstUrl(pd.image),
      price: String(price.sale_price_decimal ?? ""),
      original_price: String(price.origin_price_decimal ?? ""),
      discount: String(price.discount_format ?? ""),
      currency: String(price.currency_symbol ?? price.currency_name ?? ""),
      rating: toFloat(rate.score),
      review_count: toInt(rate.review_count),
      sold_count: toInt(sold.sold_count),
      seller_id: String(seller.seller_id ?? ""),
      seller_name: String(seller.shop_name ?? ""),
      brand: String(brand.brand_name ?? ""),
      url: String(seo.canonical_url ?? ""),
      labels: [...new Set(labels)].sort(),
    });
  }
  return rows;
}

function parseShopPage(data: unknown): AnyDict {
  if (!data || typeof data !== "object") return { has_more: false };
  const d = data as AnyDict;
  const lm = (d.load_more_params && typeof d.load_more_params === "object" ? d.load_more_params : {}) as AnyDict;
  return {
    has_more: Boolean(d.has_more),
    offset: toInt(lm.offset, 0) ?? 0,
    page_token: String(lm.page_token ?? ""),
  };
}

function parseProductDetail(data: unknown): AnyDict {
  if (!data || typeof data !== "object") return {};
  const d = data as AnyDict;
  const pc = (d.page_config && typeof d.page_config === "object" ? d.page_config : {}) as AnyDict;
  const comps = Array.isArray(pc.components_map) ? pc.components_map.filter((c): c is AnyDict => !!c && typeof c === "object") : [];
  const byName = new Map(comps.map((c) => [c.component_name, c]));
  const pi = (byName.get("product_info") ?? {}) as AnyDict;
  const cd = (pi.component_data && typeof pi.component_data === "object" ? pi.component_data : {}) as AnyDict;
  const infoObj = (cd.product_info && typeof cd.product_info === "object" ? cd.product_info : {}) as AnyDict;
  const pm = (infoObj.product_model && typeof infoObj.product_model === "object" ? infoObj.product_model : {}) as AnyDict;
  if (!pm || typeof pm !== "object") return {};
  const images = Array.isArray(pm.images)
    ? pm.images.map((im) => firstUrl(im)).filter(Boolean)
    : [];
  const descImages: string[] = [];
  if (Array.isArray(pm.description)) {
    for (const blk of pm.description) {
      if (blk && typeof blk === "object") {
        const b = blk as AnyDict;
        if (b.image && typeof b.image === "object") {
          const u = firstUrl(b.image);
          if (u) descImages.push(u);
        }
      }
    }
  }
  const specs = Array.isArray(pm.product_properties)
    ? pm.product_properties.filter((pp): pp is AnyDict => !!pp && typeof pp === "object")
        .map((pp) => ({
          name: String(pp.property_name ?? ""),
          values: Array.isArray(pp.property_values)
            ? pp.property_values.filter((v): v is AnyDict => !!v && typeof v === "object")
                .map((v) => String(v.property_value_name ?? "")).filter(Boolean)
            : [],
        }))
    : [];
  const variants = Array.isArray(pm.sale_properties)
    ? pm.sale_properties.filter((sp): sp is AnyDict => !!sp && typeof sp === "object")
        .map((sp) => ({
          name: String(sp.property_name ?? ""),
          values: Array.isArray(sp.property_values)
            ? sp.property_values.filter((v): v is AnyDict => !!v && typeof v === "object")
                .map((v) => String(v.property_value_name ?? "")).filter(Boolean)
            : [],
        }))
    : [];
  const vids = (pm.videos && typeof pm.videos === "object" ? pm.videos : {}) as AnyDict;
  const videoUrls = Object.values(vids)
    .filter((v): v is AnyDict => !!v && typeof v === "object" && Boolean((v as AnyDict).post_url))
    .map((v) => String(v.post_url));
  const shop = (cd.shop_info && typeof cd.shop_info === "object" ? cd.shop_info : {}) as AnyDict;
  return {
    product_id: String(pm.product_id ?? ""),
    seller_id: String(pm.seller_id ?? ""),
    name: String(pm.name ?? ""),
    sold_count: toInt(pm.sold_count),
    images,
    desc_images: descImages,
    specs,
    variants,
    sku_count: Array.isArray(pm.skus) ? pm.skus.length : 0,
    video_urls: videoUrls,
    shop: {
      seller_id: String(shop.seller_id ?? ""),
      shop_name: String(shop.shop_name ?? ""),
      shop_rating: toFloat(shop.shop_rating),
      review_count: toInt(shop.review_count),
      followers: toInt(shop.followers_count),
      shop_sold: toInt(shop.sold_count),
      on_sell_count: toInt(shop.on_sell_product_count),
    },
  };
}

function parseShopCategories(data: unknown): AnyDict[] {
  const node = (n: AnyDict): AnyDict => {
    const s = (n.self && typeof n.self === "object" ? n.self : {}) as AnyDict;
    const children = Array.isArray(n.children) ? n.children.filter((c): c is AnyDict => !!c && typeof c === "object") : [];
    return {
      category_id: String(s.category_id ?? ""),
      name: String(s.category_name ?? ""),
      level: toInt(s.category_level),
      is_leaf: Boolean(s.is_leaf),
      children: children.map(node),
    };
  };
  if (!Array.isArray(data)) return [];
  return data.filter((n): n is AnyDict => !!n && typeof n === "object").map(node);
}

function parseProductReviews(data: unknown): { reviews: AnyDict[]; summary: AnyDict } {
  if (!data || typeof data !== "object") return { reviews: [], summary: {} };
  const d = data as AnyDict;
  const raw = Array.isArray(d.product_reviews) ? d.product_reviews : [];
  const reviews = raw
    .filter((r): r is AnyDict => !!r && typeof r === "object")
    .map((r) => {
      const imgs = Array.isArray(r.review_images) ? r.review_images : [];
      const imgUrls = imgs.map((im) => (typeof im === "string" ? im : firstUrl(im))).filter(Boolean);
      return {
        review_id: String(r.review_id ?? ""),
        rating: toInt(r.review_rating),
        time: String(r.review_time ?? ""),
        verified: Boolean(r.is_verified_purchase),
        incentivized: Boolean(r.is_incentivized_review),
        reviewer: String(r.reviewer_name ?? ""),
        text: String(r.review_text ?? "").trim(),
        images: imgUrls,
        sku_spec: String(r.sku_specification ?? ""),
        country: String(r.review_country ?? ""),
      };
    });
  const rr = (d.review_ratings && typeof d.review_ratings === "object" ? d.review_ratings : {}) as AnyDict;
  const summary = {
    total: String(d.total_reviews ?? rr.review_count ?? ""),
    avg: toFloat(rr.overall_score),
    distribution: rr.rating_result && typeof rr.rating_result === "object" ? (rr.rating_result as AnyDict) : {},
    has_more: Boolean(d.has_more),
  };
  return { reviews, summary };
}

function parseIgHashtagPosts(data: unknown): { posts: AnyDict[]; pagination_token: string } {
  if (!data || typeof data !== "object") return { posts: [], pagination_token: "" };
  const d = data as AnyDict;
  const raw = Array.isArray(d.items) ? d.items : [];
  const posts = raw
    .filter((p): p is AnyDict => !!p && typeof p === "object")
    .map((p) => {
      const imgs = Array.isArray(p.image_versions) ? p.image_versions : [];
      const thumb = imgs.length && typeof imgs[0] === "object" ? String((imgs[0] as AnyDict).url ?? "") : "";
      const user = (p.user && typeof p.user === "object" ? p.user : {}) as AnyDict;
      const tags = Array.isArray(p.caption_hashtags) ? p.caption_hashtags : [];
      return {
        media_id: String(p.id ?? p.code ?? ""),
        code: String(p.code ?? ""),
        caption: String(p.caption_text ?? p.title ?? "").trim(),
        hashtags: tags.map((t) => String(t)).filter(Boolean),
        likes: toInt(p.like_count),
        comments: toInt(p.comment_count),
        plays: toInt(p.play_count ?? p.view_count),
        is_video: Boolean(p.is_video),
        media_type: toInt(p.media_type),
        thumbnail: thumb || String(p.thumbnail_url ?? ""),
        video_url: String(p.video_url ?? ""),
        taken_at: toInt(p.taken_at_ts ?? p.taken_at),
        username: String(user.username ?? ""),
        user_fullname: String(user.full_name ?? ""),
        verified: Boolean(user.is_verified),
      };
    });
  return { posts, pagination_token: String(d.pagination_token ?? "") };
}

// ── 信封包装 ──────────────────────────────────────────────────────

function envelope(action: string, fields: AnyDict): AnyDict {
  return { action, source: "tikhub", degraded: false, ...fields };
}

// ── 自举服务 ─────────────────────────────────────────────────────

export class IntelSelfhostService {
  private client = new TikHubIntelClient();

  // ── Ads ──

  async searchAds(input: {
    keyword: string; period?: number; objective?: number; industry?: string;
    countryCode?: string; page?: number; limit?: number; orderBy?: string;
  }): Promise<AnyDict> {
    const raw = await this.client.post<unknown>("/api/v1/tiktok/ads/search_ads", {
      keyword: (input.keyword ?? "").trim(),
      period: input.period ?? 180,
      page: input.page ?? 1,
      limit: input.limit ?? 20,
      country_code: input.countryCode ?? "US",
      order_by: input.orderBy ?? "for_you",
      ...(input.objective != null ? { objective: input.objective } : {}),
      ...(input.industry ? { industry: input.industry } : {}),
    });
    const data = innerData(raw);
    const d = data && typeof data === "object" ? (data as AnyDict) : {};
    return envelope("search_ads", {
      materials: parseAdMaterials(d),
      pagination: parseAdPagination(d),
    });
  }

  async adFilters(): Promise<AnyDict> {
    const raw = await this.client.post<unknown>("/api/v1/tiktok/ads/get_top_ads_filters", "");
    const data = innerData(raw);
    const d = data && typeof data === "object" ? (data as AnyDict) : {};
    return envelope("filters", { filters: parseAdFilters(d) });
  }

  async adLocations(): Promise<AnyDict> {
    const raw = await this.client.post<unknown>("/api/v1/tiktok/ads/get_location_list", "");
    const data = innerData(raw);
    const d = data && typeof data === "object" ? (data as AnyDict) : {};
    return envelope("locations", { locations: parseLocations(d) });
  }

  async hashtagDetail(input: { hashtagId: string; timeRange?: number; countryCode?: string }): Promise<AnyDict> {
    const raw = await this.client.post<unknown>("/api/v1/tiktok/ads/get_trends_hashtag_detail", {
      hashtag_id: input.hashtagId,
      time_range: input.timeRange ?? 30,
      country_code: input.countryCode ?? "US",
    });
    const d = raw && typeof raw === "object" ? (raw as AnyDict) : {};
    return envelope("hashtag_detail", { hashtag_detail: parseHashtagDetail(d) });
  }

  // ── Shop ──

  async searchProducts(input: { keyword: string; region?: string; limit?: number; offset?: number }): Promise<AnyDict> {
    const raw = await this.client.get<unknown>("/api/v1/tiktok/shop/web/fetch_search_products_list", {
      search_word: (input.keyword ?? "").trim(),
      region: input.region ?? "US",
      offset: input.offset ?? 0,
    });
    const data = innerData(raw);
    const d = data && typeof data === "object" ? (data as AnyDict) : {};
    const products = parseShopProducts(d).slice(0, input.limit ?? 20);
    const page = parseShopPage(d);
    page.size = products.length;
    return envelope("search", { products, page });
  }

  async searchSuggest(input: { keyword: string; region?: string }): Promise<AnyDict> {
    const raw = await this.client.get<unknown>("/api/v1/tiktok/shop/web/fetch_search_word_suggestion_v2", {
      search_word: (input.keyword ?? "").trim(),
      region: input.region ?? "US",
    });
    const data = innerData(raw);
    const suggestions = Array.isArray(data) ? data.map((x) => String(x)) : [];
    return envelope("suggest", { suggestions });
  }

  async shopCategories(region = "US"): Promise<AnyDict> {
    const data = await this.client.get<unknown>("/api/v1/tiktok/shop/web/fetch_products_category_list", { region });
    return envelope("categories", { categories: parseShopCategories(data) });
  }

  async productDetail(input: { productId: string; region?: string }): Promise<AnyDict> {
    const raw = await this.client.get<unknown>("/api/v1/tiktok/shop/web/fetch_product_detail_v3", {
      product_id: input.productId.trim(),
      region: input.region ?? "US",
    });
    const d = raw && typeof raw === "object" ? (raw as AnyDict) : {};
    return envelope("detail", { detail: parseProductDetail(d) });
  }

  async productReviews(input: { productId: string; region?: string; page?: number; limit?: number }): Promise<AnyDict> {
    const raw = await this.client.get<unknown>("/api/v1/tiktok/shop/web/fetch_product_reviews_v2", {
      product_id: input.productId.trim(),
      region: input.region ?? "US",
      page_start: input.page ?? 1,
      sort_rule: 2,
    });
    const data = innerData(raw);
    const parsed = parseProductReviews(data);
    return envelope("reviews", {
      reviews: parsed.reviews.slice(0, input.limit ?? 20),
      review_summary: parsed.summary,
    });
  }

  async sellerProducts(input: { sellerId: string; region?: string; limit?: number }): Promise<AnyDict> {
    const raw = await this.client.get<unknown>("/api/v1/tiktok/shop/web/fetch_seller_products_list", {
      seller_id: input.sellerId.trim(),
      region: input.region ?? "US",
    });
    const data = innerData(raw);
    const d = data && typeof data === "object" ? (data as AnyDict) : {};
    return envelope("seller", { products: parseShopProducts(d).slice(0, input.limit ?? 20) });
  }

  // ── Content / 达人 ──

  async trendingWords(limit = 30): Promise<AnyDict> {
    const data = await this.client.get<unknown>("/api/v1/tiktok/web/fetch_trending_searchwords", {});
    const d = data && typeof data === "object" ? (data as AnyDict) : {};
    return envelope("trending_words", { trending_words: parseTrendingSearchwords(d).slice(0, limit) });
  }

  async videoSearch(input: { keyword: string; limit?: number; region?: string }): Promise<AnyDict> {
    const data = await this.client.get<unknown>("/api/v1/tiktok/app/v3/fetch_video_search_result", {
      keyword: (input.keyword ?? "").trim(),
      count: Math.min(input.limit ?? 20, 30),
      offset: 0,
      sort_type: 0,
      publish_time: 0,
      region: input.region ?? "US",
    });
    const d = data && typeof data === "object" ? (data as AnyDict) : {};
    return envelope("video_search", { videos: parseVideoSearch(d) });
  }

  async musicChart(limit = 20): Promise<AnyDict> {
    const data = await this.client.get<unknown>("/api/v1/tiktok/app/v3/fetch_music_chart_list", {
      scene: 0,
      count: limit,
      cursor: 0,
    });
    const d = data && typeof data === "object" ? (data as AnyDict) : {};
    return envelope("music_chart", { music: parseMusicChart(d).slice(0, limit) });
  }

  async creatorInsights(limit = 20): Promise<AnyDict> {
    const data = await this.client.get<unknown>("/api/v1/tiktok/app/v3/fetch_creator_search_insights", {
      limit,
      offset: 0,
      tab: "all",
      language_filters: "en",
      creator_source: "general_search",
    });
    const d = data && typeof data === "object" ? (data as AnyDict) : {};
    return envelope("creator_insights", { insights: parseCreatorInsights(d).slice(0, limit) });
  }

  async creatorProfile(input: { uniqueId: string; withCountry?: boolean }): Promise<AnyDict> {
    const handle = (input.uniqueId ?? "").trim().replace(/^@/, "");
    if (!handle) return envelope("creator_profile", { profile: {}, degraded: true, failure_category: "invalid_argument", warning: "creator_profile 需要 unique_id" });
    const raw = await this.client.get<unknown>("/api/v1/tiktok/app/v3/handler_user_profile", { unique_id: handle });
    const d = raw && typeof raw === "object" ? (raw as AnyDict) : {};
    const profile = parseUserProfile(d);
    if (input.withCountry !== false && Object.keys(profile).length) {
      try {
        const c = await this.client.get<unknown>("/api/v1/tiktok/app/v3/fetch_user_country_by_username", { username: handle });
        const cd = c && typeof c === "object" ? (c as AnyDict) : {};
        profile.country = String(cd.country ?? "");
      } catch {
        profile.country = "";
      }
    }
    return envelope("creator_profile", { profile });
  }

  async igHashtagPosts(input: { keyword: string; feedType?: string; limit?: number }): Promise<AnyDict> {
    const raw = await this.client.get<unknown>("/api/v1/instagram/v2/fetch_hashtag_posts", {
      keyword: (input.keyword ?? "").trim().replace(/^#/, ""),
      feed_type: input.feedType ?? "top",
    });
    const data = raw && typeof raw === "object" ? (raw as AnyDict) : {};
    const inner = data.data && typeof data.data === "object" ? (data.data as AnyDict) : null;
    const merged: AnyDict = inner ?? data;
    if (data.pagination_token && typeof inner === "object") {
      merged.pagination_token = data.pagination_token;
    }
    const parsed = parseIgHashtagPosts(merged);
    return envelope("ig_hashtag_posts", {
      ig_posts: parsed.posts.slice(0, input.limit ?? 20),
      ig_pagination_token: parsed.pagination_token,
    });
  }
}
