import { getSupabase } from "../db";
import type {
  AlibabaProduct, B2BListingDraft, B2BPreference, ImageSkill,
  KeywordTrend, ListingUploadStatus, LongtailKeyword, TrendPlatform,
} from "../types";
import { parseJsonField } from "./base";

interface KeywordTrendRow {
  word: string;
  heat: number;
  delta: number | null;
  rank: number;
  industry: string;
  source: string;
}

export async function clearKeywordTrends(platform: TrendPlatform): Promise<void> {
  const sb = getSupabase();
  await sb.from("wf_keyword_trends").delete().eq("platform", platform);
}

export async function insertKeywordTrend(t: {
  id: string; platform: TrendPlatform; industryId: string; word: string;
  heat: number; delta: number | null; rank: number; industry: string; source: string;
}): Promise<void> {
  const sb = getSupabase();
  await sb.from("wf_keyword_trends").upsert(
    {
      id: t.id,
      platform: t.platform,
      industry_id: t.industryId,
      word: t.word,
      heat: t.heat,
      delta: t.delta,
      rank: t.rank,
      industry: t.industry,
      source: t.source,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
}

export async function getKeywordTrends(platform: TrendPlatform, limit = 50): Promise<KeywordTrend[]> {
  const sb = getSupabase();
  const { data } = await sb
    .from("wf_keyword_trends")
    .select("word, heat, delta, rank, industry, source")
    .eq("platform", platform)
    .order("rank", { ascending: true })
    .order("heat", { ascending: false })
    .limit(limit);
  return (data as KeywordTrendRow[]) ?? [];
}

export async function clearLongtail(industry: string): Promise<void> {
  const sb = getSupabase();
  await sb.from("wf_longtail_keywords").delete().eq("industry", industry);
}

export async function insertLongtail(t: { id: string; industry: string; word: string; category: string; searchIntent: string }): Promise<void> {
  const sb = getSupabase();
  await sb.from("wf_longtail_keywords").upsert(
    {
      id: t.id,
      industry: t.industry,
      word: t.word,
      category: t.category,
      search_intent: t.searchIntent,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
}

export async function getLongtail(industry: string, limit = 50): Promise<LongtailKeyword[]> {
  const sb = getSupabase();
  const { data } = await sb
    .from("wf_longtail_keywords")
    .select("word, category, search_intent")
    .eq("industry", industry)
    .order("id", { ascending: true })
    .limit(limit);
  const rows = (data as Array<{ word: string; category: string; search_intent: string }>) ?? [];
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
  const sb = getSupabase();
  await sb.from("wf_b2b_products").delete().neq("id", "");
}

export async function insertProduct(p: AlibabaProduct): Promise<void> {
  const sb = getSupabase();
  await sb.from("wf_b2b_products").upsert(
    {
      id: `bp-${p.productId}`,
      product_id: p.productId,
      subject: p.subject,
      keywords: JSON.stringify(p.keywords),
      image_url: p.imageUrl,
      price: p.price,
      status: p.status,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
}

export async function getProducts(limit = 100): Promise<AlibabaProduct[]> {
  const sb = getSupabase();
  const { data } = await sb
    .from("wf_b2b_products")
    .select("*")
    .order("id", { ascending: true })
    .limit(limit);
  const rows = (data as ProductRow[]) ?? [];
  return rows.map(rowToProduct);
}

export async function getProduct(productId: string): Promise<AlibabaProduct | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("wf_b2b_products")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();
  return data ? rowToProduct(data as ProductRow) : null;
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
  const sb = getSupabase();
  await sb.from("wf_b2b_listings").upsert(
    {
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
    { onConflict: "id", ignoreDuplicates: true },
  );
}

export async function getListings(limit = 50): Promise<B2BListingDraft[]> {
  const sb = getSupabase();
  const { data } = await sb
    .from("wf_b2b_listings")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  const rows = (data as ListingRow[]) ?? [];
  return rows.map(rowToListing);
}

export async function getListing(id: string): Promise<B2BListingDraft | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("wf_b2b_listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? rowToListing(data as ListingRow) : null;
}

export async function updateListing(id: string, data: {
  uploadStatus?: ListingUploadStatus; uploadedProductId?: string; imageUrl?: string;
}): Promise<void> {
  const sb = getSupabase();
  const updateData: Record<string, unknown> = {};
  if (data.uploadStatus !== undefined) updateData.upload_status = data.uploadStatus;
  if (data.uploadedProductId !== undefined) updateData.uploaded_product_id = data.uploadedProductId;
  if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;
  if (Object.keys(updateData).length === 0) return;
  await sb.from("wf_b2b_listings").update(updateData).eq("id", id);
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
  const sb = getSupabase();
  await sb.from("wf_image_skills").upsert(
    {
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
    { onConflict: "id", ignoreDuplicates: true },
  );
}

export async function getImageSkills(): Promise<ImageSkill[]> {
  const sb = getSupabase();
  const { data } = await sb
    .from("wf_image_skills")
    .select("*")
    .order("usage_count", { ascending: false })
    .order("id", { ascending: true });
  const rows = (data as ImageSkillRow[]) ?? [];
  return rows.map(rowToImageSkill);
}

export async function getImageSkill(id: string): Promise<ImageSkill | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("wf_image_skills")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? rowToImageSkill(data as ImageSkillRow) : null;
}

export async function updateImageSkill(id: string, data: { name?: string; reversedPrompt?: string; styleTags?: string[]; aspectRatio?: string; templateType?: ImageSkill["templateType"] }): Promise<void> {
  const sb = getSupabase();
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.reversedPrompt !== undefined) updateData.reversed_prompt = data.reversedPrompt;
  if (data.styleTags !== undefined) updateData.style_tags = JSON.stringify(data.styleTags);
  if (data.aspectRatio !== undefined) updateData.aspect_ratio = data.aspectRatio;
  if (data.templateType !== undefined) updateData.template_type = data.templateType;
  if (Object.keys(updateData).length === 0) return;
  await sb.from("wf_image_skills").update(updateData).eq("id", id);
}

export async function incrementImageSkillUsage(id: string): Promise<void> {
  const sb = getSupabase();
  try {
    const { error } = await sb.rpc("increment_image_skill_usage", { skill_id: id });
    if (!error) return;
  } catch {
    // RPC 不存在或执行失败 → 回退为手动自增
  }
  const { data } = await sb.from("wf_image_skills").select("usage_count").eq("id", id).maybeSingle();
  const current = (data as { usage_count: number } | null)?.usage_count ?? 0;
  await sb.from("wf_image_skills").update({ usage_count: current + 1 }).eq("id", id);
}
