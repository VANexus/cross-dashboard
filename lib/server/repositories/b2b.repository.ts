import { prisma } from "@/lib/server/db";
import type {
  AlibabaProduct, B2BListingDraft, B2BPreference, ImageSkill,
  KeywordTrend, ListingUploadStatus, LongtailKeyword, TrendPlatform,
} from "@/lib/shared/types";
import { ignoreNotFound, parseJsonField } from "./base";

interface KeywordTrendRow {
  word: string;
  heat: number;
  delta: number | null;
  rank: number;
  industry: string;
  source: string;
}

export async function clearKeywordTrends(platform: TrendPlatform): Promise<void> {
  await prisma.wf_keyword_trends.deleteMany({ where: { platform } });
}

export async function insertKeywordTrend(t: {
  id: string; platform: TrendPlatform; industryId: string; word: string;
  heat: number; delta: number | null; rank: number; industry: string; source: string;
}): Promise<void> {
  // ON CONFLICT DO NOTHING（原 upsert ignoreDuplicates: true）
  await prisma.wf_keyword_trends.createMany({
    data: {
      id: t.id,
      platform: t.platform,
      industry_id: t.industryId,
      word: t.word,
      heat: t.heat,
      delta: t.delta,
      rank: t.rank,
      industry: t.industry,
      source: t.source,
      fetched_at: new Date().toISOString(),
    },
    skipDuplicates: true,
  });
}

export async function getKeywordTrends(platform: TrendPlatform, limit = 50): Promise<KeywordTrend[]> {
  const rows = await prisma.wf_keyword_trends.findMany({
    where: { platform },
    select: { word: true, heat: true, delta: true, rank: true, industry: true, source: true },
    orderBy: [{ rank: "asc" }, { heat: "desc" }],
    take: limit,
  });
  return rows as unknown as KeywordTrendRow[];
}

/** 该平台趋势数据的最近抓取时间（ISO 串）；无数据返回 null。GET 秒回 + 后台保鲜用。 */
export async function getKeywordTrendsFetchedAt(platform: TrendPlatform): Promise<string | null> {
  const row = await prisma.wf_keyword_trends.findFirst({
    where: { platform },
    select: { fetched_at: true },
    orderBy: { fetched_at: { sort: "desc", nulls: "last" } },
  });
  return row?.fetched_at ?? null;
}

// ── 趋势时序快照（P1）──

/** 当地 UTC 日期串 YYYY-MM-DD（与快照口径一致）。 */
function utcDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** @db.Date 列读出为 Date → 还原 YYYY-MM-DD 字符串（与原 date 列口径一致）。 */
function dateStr(v: Date | string): string {
  return (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);
}

/** 幂等写入某平台当日快照（同 平台/日期/词 upsert），并顺带清理 100 天前数据。 */
export async function replaceTrendSnapshots(
  platform: TrendPlatform,
  keywords: KeywordTrend[],
  date = utcDate(),
): Promise<void> {
  if (keywords.length === 0) return;
  // snapshot_date 是 @db.Date 列：Prisma 写入需完整 ISO-8601 DateTime（"YYYY-MM-DD" 串会被拒）
  const dateStart = new Date(`${date}T00:00:00.000Z`);
  const rows = keywords.map((k, i) => ({
    id: `${platform}:${date}:${k.word}`,
    platform,
    word: k.word,
    heat: BigInt(k.heat),
    delta: k.delta == null ? null : BigInt(k.delta),
    rank: k.rank || i + 1,
    industry: k.industry || "通用",
    source: k.source || "",
    snapshot_date: dateStart,
  }));
  // Prisma 无批量 upsert：按 平台/日期/词 复合唯一键逐行 upsert（ON CONFLICT DO UPDATE）
  for (const row of rows) {
    await prisma.wf_trend_snapshots.upsert({
      where: {
        platform_snapshot_date_word: { platform: row.platform, snapshot_date: row.snapshot_date, word: row.word },
      },
      create: row,
      update: {
        id: row.id,
        heat: row.heat,
        delta: row.delta,
        rank: row.rank,
        industry: row.industry,
        source: row.source,
      },
    });
  }
  // 清理超期快照（migration 00010 提供函数；失败静默，非关键路径）
  try {
    await prisma.$executeRaw`SELECT trim_trend_snapshots(100)`;
  } catch {
    // 函数尚未应用或执行失败均不阻塞快照写入
  }
}

/** 读取近 days 天快照（按日期升序、rank 升序），供趋势线/飙升榜计算。 */
export async function getTrendSnapshots(
  platform: TrendPlatform,
  days = 14,
): Promise<Array<{
  word: string; heat: number; delta: number | null; rank: number;
  industry: string; source: string; snapshotDate: string;
}>> {
  const since = utcDate(new Date(Date.now() - days * 86_400_000));
  const rows = await prisma.wf_trend_snapshots.findMany({
    where: { platform, snapshot_date: { gte: since } },
    select: { word: true, heat: true, delta: true, rank: true, industry: true, source: true, snapshot_date: true },
    orderBy: [{ snapshot_date: "asc" }, { rank: "asc" }],
  });
  return rows.map((r) => ({
    word: r.word,
    heat: Number(r.heat),
    delta: r.delta == null ? null : Number(r.delta),
    rank: r.rank,
    industry: r.industry,
    source: r.source,
    snapshotDate: dateStr(r.snapshot_date),
  }));
}

export async function clearLongtail(industry: string): Promise<void> {
  await prisma.wf_longtail_keywords.deleteMany({ where: { industry } });
}

export async function insertLongtail(t: { id: string; industry: string; word: string; category: string; searchIntent: string }): Promise<void> {
  await prisma.wf_longtail_keywords.createMany({
    data: {
      id: t.id,
      industry: t.industry,
      word: t.word,
      category: t.category,
      search_intent: t.searchIntent,
    },
    skipDuplicates: true,
  });
}

export async function getLongtail(industry: string, limit = 50): Promise<LongtailKeyword[]> {
  const rows = await prisma.wf_longtail_keywords.findMany({
    where: { industry },
    select: { word: true, category: true, search_intent: true },
    orderBy: { id: "asc" },
    take: limit,
  });
  return rows.map((r) => ({ word: r.word, category: r.category, searchIntent: r.search_intent }));
}

interface ProductRow {
  product_id: string;
  subject: string;
  keywords: string;
  image_url: string;
  price: string;
  status: string;
}

function rowToProduct(r: ProductRow): AlibabaProduct {
  return {
    productId: r.product_id,
    subject: r.subject,
    keywords: parseJsonField<string[]>(r.keywords, []),
    imageUrl: r.image_url,
    price: r.price,
    status: r.status,
  };
}

export async function clearProducts(): Promise<void> {
  await prisma.wf_b2b_products.deleteMany({ where: { NOT: { id: "" } } });
}

export async function insertProduct(p: AlibabaProduct): Promise<void> {
  const data = {
    product_id: p.productId,
    subject: p.subject,
    keywords: JSON.stringify(p.keywords),
    image_url: p.imageUrl,
    price: p.price,
    status: p.status,
    fetched_at: new Date().toISOString(),
  };
  // 原 upsert ignoreDuplicates: false → ON CONFLICT (id) DO UPDATE
  await prisma.wf_b2b_products.upsert({
    where: { id: `bp-${p.productId}` },
    create: { id: `bp-${p.productId}`, ...data },
    update: data,
  });
}

/** 商品池最近一次抓取时间（ISO 串）；空池返回 null。GET 秒回 + 后台保鲜用。 */
export async function getProductsFetchedAt(): Promise<string | null> {
  const row = await prisma.wf_b2b_products.findFirst({
    select: { fetched_at: true },
    orderBy: { fetched_at: { sort: "desc", nulls: "last" } },
  });
  return row?.fetched_at ?? null;
}

export async function getProducts(limit = 100): Promise<AlibabaProduct[]> {
  const rows = await prisma.wf_b2b_products.findMany({
    orderBy: { id: "asc" },
    take: limit,
  });
  return (rows as unknown as ProductRow[]).map(rowToProduct);
}

export async function getProduct(productId: string): Promise<AlibabaProduct | null> {
  const row = await prisma.wf_b2b_products.findFirst({ where: { product_id: productId } });
  return row ? rowToProduct(row as unknown as ProductRow) : null;
}

interface ListingRow {
  id: string;
  product_id: string;
  preference: string;
  title: string;
  description: string;
  keywords: string;
  image_url: string;
  image_prompt: string;
  upload_status: string;
  uploaded_product_id: string;
  created_at: string;
}

function rowToListing(r: ListingRow): B2BListingDraft {
  return {
    id: r.id,
    productId: r.product_id,
    preference: r.preference as B2BPreference,
    title: r.title,
    description: r.description,
    keywords: parseJsonField<string[]>(r.keywords, []),
    imageUrl: r.image_url,
    imagePrompt: r.image_prompt,
    uploadStatus: r.upload_status as ListingUploadStatus,
    uploadedProductId: r.uploaded_product_id,
    createdAt: r.created_at,
  };
}

export async function insertListing(l: {
  id: string; productId: string; preference: B2BPreference; title: string;
  description: string; keywords: string[]; imageUrl: string; imagePrompt: string;
}): Promise<void> {
  await prisma.wf_b2b_listings.createMany({
    data: {
      id: l.id,
      product_id: l.productId,
      preference: l.preference,
      title: l.title,
      description: l.description,
      keywords: JSON.stringify(l.keywords),
      image_url: l.imageUrl,
      image_prompt: l.imagePrompt,
      upload_status: "draft",
    },
    skipDuplicates: true,
  });
}

export async function getListings(limit = 50): Promise<B2BListingDraft[]> {
  const rows = await prisma.wf_b2b_listings.findMany({
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: limit,
  });
  return (rows as unknown as ListingRow[]).map(rowToListing);
}

export async function getListing(id: string): Promise<B2BListingDraft | null> {
  const row = await prisma.wf_b2b_listings.findUnique({ where: { id } });
  return row ? rowToListing(row as unknown as ListingRow) : null;
}

export async function updateListing(id: string, data: {
  uploadStatus?: ListingUploadStatus; uploadedProductId?: string; imageUrl?: string;
}): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (data.uploadStatus !== undefined) updateData.upload_status = data.uploadStatus;
  if (data.uploadedProductId !== undefined) updateData.uploaded_product_id = data.uploadedProductId;
  if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;
  if (Object.keys(updateData).length === 0) return;
  await ignoreNotFound(() => prisma.wf_b2b_listings.update({ where: { id }, data: updateData }));
}

interface ImageSkillRow {
  id: string;
  name: string;
  cover_url: string;
  reversed_prompt: string;
  style_tags: string;
  aspect_ratio: string;
  platform: string;
  template_type: string;
  is_builtin: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

function rowToImageSkill(r: ImageSkillRow): ImageSkill {
  return {
    id: r.id,
    name: r.name,
    coverUrl: r.cover_url,
    reversedPrompt: r.reversed_prompt,
    styleTags: parseJsonField<string[]>(r.style_tags, []),
    aspectRatio: r.aspect_ratio,
    platform: r.platform,
    templateType: (r.template_type as ImageSkill["templateType"]) ?? "",
    isBuiltin: Boolean(r.is_builtin ?? false),
    usageCount: r.usage_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function insertImageSkill(s: {
  id: string; name: string; coverUrl: string; reversedPrompt: string;
  styleTags: string[]; aspectRatio: string; platform: string;
  templateType?: ImageSkill["templateType"]; isBuiltin?: boolean;
}): Promise<void> {
  await prisma.wf_image_skills.createMany({
    data: {
      id: s.id,
      name: s.name,
      cover_url: s.coverUrl,
      reversed_prompt: s.reversedPrompt,
      style_tags: JSON.stringify(s.styleTags),
      aspect_ratio: s.aspectRatio,
      platform: s.platform,
      template_type: s.templateType ?? "",
      is_builtin: s.isBuiltin ?? false,
    },
    skipDuplicates: true,
  });
}

export async function getImageSkills(): Promise<ImageSkill[]> {
  const rows = await prisma.wf_image_skills.findMany({
    orderBy: [{ usage_count: "desc" }, { id: "asc" }],
  });
  return (rows as unknown as ImageSkillRow[]).map(rowToImageSkill);
}

export async function getImageSkill(id: string): Promise<ImageSkill | null> {
  const row = await prisma.wf_image_skills.findUnique({ where: { id } });
  return row ? rowToImageSkill(row as unknown as ImageSkillRow) : null;
}

export async function updateImageSkill(id: string, data: { name?: string; reversedPrompt?: string; styleTags?: string[]; aspectRatio?: string; templateType?: ImageSkill["templateType"] }): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.reversedPrompt !== undefined) updateData.reversed_prompt = data.reversedPrompt;
  if (data.styleTags !== undefined) updateData.style_tags = JSON.stringify(data.styleTags);
  if (data.aspectRatio !== undefined) updateData.aspect_ratio = data.aspectRatio;
  if (data.templateType !== undefined) updateData.template_type = data.templateType;
  if (Object.keys(updateData).length === 0) return;
  await ignoreNotFound(() => prisma.wf_image_skills.update({ where: { id }, data: updateData }));
}

export async function incrementImageSkillUsage(id: string): Promise<void> {
  try {
    await prisma.$executeRaw`SELECT increment_image_skill_usage(${id})`;
    return;
  } catch {
    // 函数不存在或执行失败 → 回退为手动自增
  }
  const row = await prisma.wf_image_skills.findUnique({ where: { id }, select: { usage_count: true } });
  const current = row?.usage_count ?? 0;
  await ignoreNotFound(() => prisma.wf_image_skills.update({ where: { id }, data: { usage_count: current + 1 } }));
}
