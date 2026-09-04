import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import type {
  DataSource, ProductKeyword, PainPoint, GeneratedImg,
  StoryboardFrame, AdKeyword, AdPosition, CategoryRec,
  BulletPoint, InfringementWord, InventoryItem, RestockSuggestion,
  KeywordItem, CompetitorEntry, WorkflowStatus,
} from "@/lib/shared/types";
import { type PaginatedResult, parseJsonField } from "./base";

export async function getDataSources(): Promise<DataSource[]> {
  const rows = await prisma.wf_data_sources.findMany({ orderBy: { id: "asc" } });
  return ((rows as Array<{
    id: string; name: string; enabled: number; status: string; progress: number;
  }>) ?? []).map((r) => ({
    id: r.id, name: r.name, enabled: !!r.enabled,
    status: r.status as DataSource["status"], progress: r.progress,
  }));
}

export async function getProductKeywords(marketplace?: string): Promise<ProductKeyword[]> {
  const rows = await prisma.wf_product_keywords.findMany({
    where: marketplace ? { marketplace } : {},
  });
  return ((rows as Array<{
    keyword: string; volume: number; cpc: number; competition: number;
    supply_demand: number; trend: string; ai_tag: string;
  }>) ?? []).map((r) => ({
    keyword: r.keyword, volume: r.volume, cpc: r.cpc, competition: r.competition,
    supplyDemand: r.supply_demand, trend: parseJsonField<number[]>(r.trend, []),
    aiTag: r.ai_tag as ProductKeyword["aiTag"],
  }));
}

export async function getPainPoints(): Promise<PainPoint[]> {
  const rows = await prisma.wf_pain_points.findMany({ orderBy: { count: "desc" } });
  return ((rows as Array<{
    category: string; count: number; pct: number; examples: string;
  }>) ?? []).map((r) => ({
    category: r.category, count: r.count, pct: r.pct,
    examples: parseJsonField<string[]>(r.examples, []),
  }));
}

export async function getImages(type?: string): Promise<GeneratedImg[]> {
  const rows = await prisma.wf_generated_images.findMany({
    where: type ? { type } : {},
    orderBy: { created_at: "desc" },
  });
  return ((rows as Array<{
    id: string; type: string; url: string; clip_score: number; ctr_score: number;
    overall: number; is_best: number; prompt: string; model: string; seed: number; revised_prompt: string | null;
  }>) ?? []).map((r) => ({
    id: r.id, type: r.type, url: r.url || undefined, clipScore: r.clip_score, ctrScore: r.ctr_score,
    overall: r.overall, isBest: !!r.is_best, prompt: r.prompt,
    model: r.model, seed: r.seed, revisedPrompt: r.revised_prompt ?? undefined,
  }));
}

export async function insertImage(img: { id: string; type: string; url: string; prompt: string; model: string; revisedPrompt?: string }): Promise<void> {
  await prisma.wf_generated_images.create({
    data: {
      id: img.id,
      type: img.type,
      url: img.url,
      prompt: img.prompt,
      model: img.model,
      revised_prompt: img.revisedPrompt ?? null,
    },
  });
}

export async function updateImage(id: string, data: Partial<GeneratedImg>): Promise<GeneratedImg | null> {
  const updateData: Prisma.wf_generated_imagesUpdateInput = {};

  if (data.isBest !== undefined) updateData.is_best = data.isBest ? 1 : 0;
  if (data.clipScore !== undefined) updateData.clip_score = data.clipScore;
  if (data.ctrScore !== undefined) updateData.ctr_score = data.ctrScore;
  if (data.overall !== undefined) updateData.overall = data.overall;

  if (Object.keys(updateData).length > 0) {
    await prisma.wf_generated_images.update({ where: { id }, data: updateData });
  }

  const imgs = await getImages();
  return imgs.find((i) => i.id === id) ?? null;
}

export async function getStoryboardFrames(): Promise<StoryboardFrame[]> {
  const rows = await prisma.wf_storyboard_frames.findMany({ orderBy: { sort_order: "asc" } });
  return ((rows as Array<{
    id: string; description: string; duration: string; script: string;
    camera: string; source: string;
  }>) ?? []).map((r) => ({
    id: r.id, desc: r.description, duration: r.duration,
    script: r.script, camera: r.camera, source: r.source,
  }));
}

export async function getAdKeywords(filters?: { type?: string; tag?: string }): Promise<AdKeyword[]> {
  const where: Prisma.wf_ad_keywordsWhereInput = {};
  if (filters?.type) where.type = filters.type;
  if (filters?.tag) where.tag = filters.tag;
  const rows = await prisma.wf_ad_keywords.findMany({ where });
  return ((rows as Array<{
    id: string; keyword: string; impressions: number; clicks: number;
    spend: number; sales: number; acos: number; conversion: number;
    cpc: number; tag: string; type: string; trend: string;
  }>) ?? []).map((r) => ({
    id: r.id, keyword: r.keyword, impressions: r.impressions, clicks: r.clicks,
    spend: r.spend, sales: r.sales, acos: r.acos, conversion: r.conversion,
    cpc: r.cpc, tag: r.tag as AdKeyword["tag"], type: r.type as AdKeyword["type"],
    trend: parseJsonField<number[]>(r.trend, []),
  }));
}

export async function updateAdKeyword(id: string, data: Partial<AdKeyword>): Promise<AdKeyword | null> {
  const updateData: Prisma.wf_ad_keywordsUpdateInput = {};

  if (data.cpc !== undefined) updateData.cpc = data.cpc;
  if (data.tag !== undefined) updateData.tag = data.tag;

  if (Object.keys(updateData).length > 0) {
    await prisma.wf_ad_keywords.update({ where: { id }, data: updateData });
  }

  const kws = await getAdKeywords();
  return kws.find((k) => k.id === id) ?? null;
}

export async function getAdPositions(): Promise<AdPosition[]> {
  const rows = await prisma.wf_ad_positions.findMany({ orderBy: { id: "asc" } });
  return ((rows as Array<{
    position: string; share: number; trend: string;
  }>) ?? []).map((r) => ({
    position: r.position, share: r.share,
    trend: parseJsonField<number[]>(r.trend, []),
  }));
}

export async function getCategoryRecs(): Promise<CategoryRec[]> {
  const rows = await prisma.wf_categories.findMany({ orderBy: { confidence: "desc" } });
  return ((rows as Array<{
    id: string; name: string; confidence: number; reason: string; bsr: number; fee: number;
  }>) ?? []).map((r) => ({
    id: r.id, name: r.name, confidence: r.confidence,
    reason: r.reason, bsr: r.bsr, fee: r.fee,
  }));
}

export async function getBulletPoints(): Promise<BulletPoint[]> {
  const rows = await prisma.wf_bullet_points.findMany({ orderBy: { seo_score: "desc" } });
  return ((rows as Array<{
    id: string; title: string; content: string; seo_score: number; rufus: number;
  }>) ?? []).map((r) => ({
    id: r.id, title: r.title, content: r.content,
    seoScore: r.seo_score, rufus: !!r.rufus,
  }));
}

export async function getInfringementWords(): Promise<InfringementWord[]> {
  const rows = await prisma.wf_infringement_words.findMany({ orderBy: { id: "asc" } });
  return ((rows as Array<{
    word: string; type: string; risk: string; action: string;
  }>) ?? []).map((r) => ({
    word: r.word, type: r.type as InfringementWord["type"],
    risk: r.risk, action: r.action,
  }));
}

export async function getInventoryItems(filters?: {
  status?: string; page?: number; pageSize?: number;
}): Promise<PaginatedResult<InventoryItem>> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const where: Prisma.wf_inventoryWhereInput = {};
  if (filters?.status) where.status = filters.status;

  const [total, items] = await Promise.all([
    prisma.wf_inventory.count({ where }),
    prisma.wf_inventory.findMany({
      where,
      orderBy: { sku: "asc" },
      take: pageSize,
      skip: offset,
    }),
  ]);

  return {
    items: ((items as Array<{
      id: string; sku: string; name: string; stock: number; daily_sales: number;
      ratio_days: number; stockout_date: string | null; restock_qty: number;
      restock_date: string | null; status: string; trend: string;
      avg_cost: number; ship_days: number;
    }>) ?? []).map((r) => ({
      id: r.id, sku: r.sku, name: r.name, stock: r.stock,
      dailySales: r.daily_sales, ratioDays: r.ratio_days,
      stockoutDate: r.stockout_date ?? "", restockQty: r.restock_qty,
      restockDate: r.restock_date ?? "-", status: r.status as InventoryItem["status"],
      trend: parseJsonField<number[]>(r.trend, []),
      avgCost: r.avg_cost, shipDays: r.ship_days,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getRestockSuggestions(): Promise<RestockSuggestion[]> {
  const rows = await prisma.wf_inventory.findMany({
    where: { restock_qty: { gt: 0 } },
    orderBy: { ratio_days: "asc" },
  });
  return ((rows as Array<{
    id: string; sku: string; name: string; restock_qty: number;
    ratio_days: number; restock_date: string | null; avg_cost: number; ship_days: number;
  }>) ?? []).map((r) => ({
    id: `rs-${r.sku}`, sku: r.sku, name: r.name,
    suggestedQty: r.restock_qty,
    urgency: (r.ratio_days < 15 ? "high" : r.ratio_days < 30 ? "medium" : "low") as RestockSuggestion["urgency"],
    method: r.ship_days <= 25 ? "express" : "sea",
    eta: r.restock_date ?? "-",
    cost: Math.round(r.restock_qty * r.avg_cost * 0.6),
  }));
}

export async function getCompetitorKeywords(type?: string): Promise<KeywordItem[]> {
  const rows = await prisma.wf_competitor_keywords.findMany({
    where: type ? { type } : {},
  });
  return ((rows as Array<{
    keyword: string; volume: number; competition: number; cpc: number; trend: string; type: string;
  }>) ?? []).map((r) => ({
    keyword: r.keyword, volume: r.volume, competition: r.competition,
    cpc: r.cpc, trend: parseJsonField<number[]>(r.trend, []),
    type: r.type as KeywordItem["type"],
  }));
}

export async function getCompetitors(): Promise<CompetitorEntry[]> {
  const rows = await prisma.wf_competitors.findMany({ orderBy: { rank: "asc" } });
  return ((rows as Array<{
    id: string; name: string; sp_count: number; sb_count: number;
    sd_count: number; keywords: number; rank: number; strategy: string;
  }>) ?? []).map((r) => ({
    id: r.id, name: r.name, spCount: r.sp_count, sbCount: r.sb_count,
    sdCount: r.sd_count, keywords: r.keywords, rank: r.rank,
    strategy: r.strategy as CompetitorEntry["strategy"],
  }));
}

export async function getWorkflowStatuses(): Promise<WorkflowStatus[]> {
  if (process.env.DASH_BENCH) {
    const g = globalThis as any;
    g.__wfExec = (g.__wfExec ?? 0) + 1;
    const fs = await import("fs");
    fs.appendFileSync("dash-bench-wf.log", `[dash-bench] getWorkflowStatuses exec #${g.__wfExec} ts=${Date.now()}\n`);
  }
  const rows = await prisma.wf_workflow_statuses.findMany({ orderBy: { id: "asc" } });
  return ((rows as Array<{
    id: string; name: string; href: string; status: string;
    last_run: string | null; run_count: number; success_rate: number;
  }>) ?? []).map((r) => ({
    id: r.id, name: r.name, href: r.href,
    status: r.status as WorkflowStatus["status"],
    lastRun: r.last_run ?? "", runs: r.run_count, success: r.success_rate,
  }));
}

export async function updateWorkflowStatus(id: string, data: { status?: string; lastRun?: string; runCount?: number; successRate?: number }): Promise<void> {
  const updateData: Prisma.wf_workflow_statusesUpdateInput = {};

  if (data.status !== undefined) updateData.status = data.status;
  if (data.lastRun !== undefined) updateData.last_run = data.lastRun;
  if (data.runCount !== undefined) updateData.run_count = data.runCount;
  if (data.successRate !== undefined) updateData.success_rate = data.successRate;

  if (Object.keys(updateData).length === 0) return;
  await prisma.wf_workflow_statuses.update({ where: { id }, data: updateData });
}

export async function insertAdAnalysis(data: {
  id: string; keyword: string; currentData: unknown; resultJson: unknown;
}): Promise<void> {
  await prisma.wf_ad_analyses.create({
    data: {
      id: data.id,
      keyword: data.keyword,
      current_data: JSON.stringify(data.currentData),
      result_json: JSON.stringify(data.resultJson),
    },
  });
}

export async function getRecentAdAnalyses(limit = 10): Promise<Array<{ id: string; keyword: string; resultJson: unknown; createdAt: string }>> {
  const rows = await prisma.wf_ad_analyses.findMany({
    orderBy: { created_at: "desc" },
    take: limit,
  });
  return ((rows as Array<{
    id: string; keyword: string; result_json: string; created_at: string;
  }>) ?? []).map((r) => ({
    id: r.id, keyword: r.keyword,
    resultJson: parseJsonField(r.result_json, {}), createdAt: r.created_at,
  }));
}

export async function insertResearchResult(data: {
  id: string; marketplace: string; category: string; keywords: string[]; sources: string[]; resultJson: unknown;
}): Promise<void> {
  await prisma.wf_generated_research.create({
    data: {
      id: data.id,
      marketplace: data.marketplace,
      category: data.category,
      keywords: JSON.stringify(data.keywords),
      sources: JSON.stringify(data.sources),
      result_json: JSON.stringify(data.resultJson),
    },
  });
}

export async function getRecentResearchResults(limit = 10): Promise<Array<{ id: string; marketplace: string; category: string; resultJson: unknown; createdAt: string }>> {
  const rows = await prisma.wf_generated_research.findMany({
    orderBy: { created_at: "desc" },
    take: limit,
  });
  return ((rows as Array<{
    id: string; marketplace: string; category: string; result_json: string; created_at: string;
  }>) ?? []).map((r) => ({
    id: r.id, marketplace: r.marketplace, category: r.category,
    resultJson: parseJsonField(r.result_json, {}), createdAt: r.created_at,
  }));
}

export async function insertListingResult(data: {
  id: string; keyword: string; category: string; language: string;
  title: string; bullets: string[]; description: string; searchTerms: string[];
  seoScore: number; estimatedCtr: string; resultJson: unknown;
}): Promise<void> {
  await prisma.wf_generated_listings.create({
    data: {
      id: data.id,
      keyword: data.keyword,
      category: data.category,
      language: data.language,
      title: data.title,
      bullets: JSON.stringify(data.bullets),
      description: data.description,
      search_terms: JSON.stringify(data.searchTerms),
      seo_score: data.seoScore,
      estimated_ctr: data.estimatedCtr,
      result_json: JSON.stringify(data.resultJson),
    },
  });
}

export async function getRecentListingResults(limit = 10): Promise<Array<{ id: string; keyword: string; title: string; resultJson: unknown; createdAt: string }>> {
  const rows = await prisma.wf_generated_listings.findMany({
    orderBy: { created_at: "desc" },
    take: limit,
  });
  return ((rows as Array<{
    id: string; keyword: string; title: string; result_json: string; created_at: string;
  }>) ?? []).map((r) => ({
    id: r.id, keyword: r.keyword, title: r.title,
    resultJson: parseJsonField(r.result_json, {}), createdAt: r.created_at,
  }));
}

export async function insertCompetitorAnalysis(data: {
  id: string; asins: string[]; marketplace: string; keywords: string[]; resultJson: unknown;
}): Promise<void> {
  await prisma.wf_generated_competitor_analysis.create({
    data: {
      id: data.id,
      asins: JSON.stringify(data.asins),
      marketplace: data.marketplace,
      keywords: JSON.stringify(data.keywords),
      result_json: JSON.stringify(data.resultJson),
    },
  });
}

export async function getRecentCompetitorAnalyses(limit = 10): Promise<Array<{ id: string; asins: string[]; resultJson: unknown; createdAt: string }>> {
  const rows = await prisma.wf_generated_competitor_analysis.findMany({
    orderBy: { created_at: "desc" },
    take: limit,
  });
  return ((rows as Array<{
    id: string; asins: string; result_json: string; created_at: string;
  }>) ?? []).map((r) => ({
    id: r.id, asins: parseJsonField<string[]>(r.asins, []),
    resultJson: parseJsonField(r.result_json, {}), createdAt: r.created_at,
  }));
}

export async function insertRestockOrder(data: { id: string; items: Array<{ sku: string; quantity: number; shipMethod: string }>; status: string }): Promise<void> {
  await prisma.wf_restock_orders.create({
    data: {
      id: data.id,
      items: JSON.stringify(data.items),
      status: data.status,
      total_items: data.items.length,
    },
  });
}

export async function getRecentRestockOrders(limit = 10): Promise<Array<{ id: string; items: Array<{ sku: string; quantity: number; shipMethod: string }>; status: string; totalItems: number; createdAt: string }>> {
  const rows = await prisma.wf_restock_orders.findMany({
    orderBy: { created_at: "desc" },
    take: limit,
  });
  return ((rows as Array<{
    id: string; items: string; status: string; total_items: number; created_at: string;
  }>) ?? []).map((r) => ({
    id: r.id,
    items: parseJsonField<Array<{ sku: string; quantity: number; shipMethod: string }>>(r.items, []),
    status: r.status, totalItems: r.total_items, createdAt: r.created_at,
  }));
}
