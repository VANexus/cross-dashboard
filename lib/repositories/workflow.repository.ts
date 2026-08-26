/**
 * FlowMind RAK — Workflow Repository
 * Data access for all workflow entities
 */
import { getDb } from "../db";
import type {
  DataSource, ProductKeyword, PainPoint, GeneratedImg,
  StoryboardFrame, AdKeyword, AdPosition, CategoryRec,
  BulletPoint, InfringementWord, InventoryItem, RestockSuggestion,
  KeywordItem, CompetitorEntry, WorkflowStatus,
} from "../types";
import { paginatedQuery, type PaginatedResult, parseJsonField } from "./base";

// ========== 选品 ==========

export function getDataSources(): DataSource[] {
  const db = getDb();
  const rows = db.query("SELECT * FROM wf_data_sources ORDER BY id").all() as Array<{
    id: string; name: string; enabled: number; status: string; progress: number;
  }>;
  return rows.map((r) => ({
    id: r.id, name: r.name, enabled: r.enabled === 1,
    status: r.status as DataSource["status"], progress: r.progress,
  }));
}

export function getProductKeywords(marketplace?: string): ProductKeyword[] {
  const db = getDb();
  let sql = "SELECT * FROM wf_product_keywords";
  const params: unknown[] = [];
  if (marketplace) { sql += " WHERE marketplace = ?"; params.push(marketplace); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = db.query(sql).all(...(params as any[])) as Array<{
    keyword: string; volume: number; cpc: number; competition: number;
    supply_demand: number; trend: string; ai_tag: string;
  }>;
  return rows.map((r) => ({
    keyword: r.keyword, volume: r.volume, cpc: r.cpc, competition: r.competition,
    supplyDemand: r.supply_demand, trend: parseJsonField<number[]>(r.trend, []),
    aiTag: r.ai_tag as ProductKeyword["aiTag"],
  }));
}

export function getPainPoints(): PainPoint[] {
  const db = getDb();
  const rows = db.query("SELECT * FROM wf_pain_points ORDER BY count DESC").all() as Array<{
    category: string; count: number; pct: number; examples: string;
  }>;
  return rows.map((r) => ({
    category: r.category, count: r.count, pct: r.pct,
    examples: parseJsonField<string[]>(r.examples, []),
  }));
}

// ========== AI 制图 ==========

export function getImages(type?: string): GeneratedImg[] {
  const db = getDb();
  let sql = "SELECT * FROM wf_generated_images";
  const params: unknown[] = [];
  if (type) { sql += " WHERE type = ?"; params.push(type); }
  sql += " ORDER BY created_at DESC";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = db.query(sql).all(...(params as any[])) as Array<{
    id: string; type: string; url: string; clip_score: number; ctr_score: number;
    overall: number; is_best: number; prompt: string; model: string; seed: number; revised_prompt: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id, type: r.type, url: r.url || undefined, clipScore: r.clip_score, ctrScore: r.ctr_score,
    overall: r.overall, isBest: r.is_best === 1, prompt: r.prompt,
    model: r.model, seed: r.seed, revisedPrompt: r.revised_prompt ?? undefined,
  }));
}

export function insertImage(img: { id: string; type: string; url: string; prompt: string; model: string; revisedPrompt?: string }): void {
  const db = getDb();
  db.run(
    "INSERT INTO wf_generated_images (id, type, url, prompt, model, revised_prompt) VALUES (?, ?, ?, ?, ?, ?)",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [img.id, img.type, img.url, img.prompt, img.model, img.revisedPrompt ?? null] as any[],
  );
}

export function updateImage(id: string, data: Partial<GeneratedImg>): GeneratedImg | null {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.isBest !== undefined) { sets.push("is_best = ?"); params.push(data.isBest ? 1 : 0); }
  if (data.clipScore !== undefined) { sets.push("clip_score = ?"); params.push(data.clipScore); }
  if (data.ctrScore !== undefined) { sets.push("ctr_score = ?"); params.push(data.ctrScore); }
  if (data.overall !== undefined) { sets.push("overall = ?"); params.push(data.overall); }

  if (sets.length === 0) return getImages().find((i) => i.id === id) ?? null;
  params.push(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db.run(`UPDATE wf_generated_images SET ${sets.join(", ")} WHERE id = ?`, params as any[]);
  return getImages().find((i) => i.id === id) ?? null;
}

export function getStoryboardFrames(): StoryboardFrame[] {
  const db = getDb();
  const rows = db.query("SELECT * FROM wf_storyboard_frames ORDER BY sort_order").all() as Array<{
    id: string; description: string; duration: string; script: string;
    camera: string; source: string;
  }>;
  return rows.map((r) => ({
    id: r.id, desc: r.description, duration: r.duration,
    script: r.script, camera: r.camera, source: r.source,
  }));
}

// ========== 广告 ==========

export function getAdKeywords(filters?: { type?: string; tag?: string }): AdKeyword[] {
  const db = getDb();
  let sql = "SELECT * FROM wf_ad_keywords WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.type) { sql += " AND type = ?"; params.push(filters.type); }
  if (filters?.tag) { sql += " AND tag = ?"; params.push(filters.tag); }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = db.query(sql).all(...(params as any[])) as Array<{
    id: string; keyword: string; impressions: number; clicks: number;
    spend: number; sales: number; acos: number; conversion: number;
    cpc: number; tag: string; type: string; trend: string;
  }>;
  return rows.map((r) => ({
    id: r.id, keyword: r.keyword, impressions: r.impressions, clicks: r.clicks,
    spend: r.spend, sales: r.sales, acos: r.acos, conversion: r.conversion,
    cpc: r.cpc, tag: r.tag as AdKeyword["tag"], type: r.type as AdKeyword["type"],
    trend: parseJsonField<number[]>(r.trend, []),
  }));
}

export function updateAdKeyword(id: string, data: Partial<AdKeyword>): AdKeyword | null {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.cpc !== undefined) { sets.push("cpc = ?"); params.push(data.cpc); }
  if (data.tag !== undefined) { sets.push("tag = ?"); params.push(data.tag); }

  if (sets.length === 0) return getAdKeywords().find((k) => k.id === id) ?? null;
  params.push(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db.run(`UPDATE wf_ad_keywords SET ${sets.join(", ")} WHERE id = ?`, params as any[]);
  return getAdKeywords().find((k) => k.id === id) ?? null;
}

export function getAdPositions(): AdPosition[] {
  const db = getDb();
  const rows = db.query("SELECT * FROM wf_ad_positions ORDER BY id").all() as Array<{
    position: string; share: number; trend: string;
  }>;
  return rows.map((r) => ({
    position: r.position, share: r.share,
    trend: parseJsonField<number[]>(r.trend, []),
  }));
}

// ========== 商品发布 ==========

export function getCategoryRecs(): CategoryRec[] {
  const db = getDb();
  const rows = db.query("SELECT * FROM wf_categories ORDER BY confidence DESC").all() as Array<{
    id: string; name: string; confidence: number; reason: string; bsr: number; fee: number;
  }>;
  return rows.map((r) => ({
    id: r.id, name: r.name, confidence: r.confidence,
    reason: r.reason, bsr: r.bsr, fee: r.fee,
  }));
}

export function getBulletPoints(): BulletPoint[] {
  const db = getDb();
  const rows = db.query("SELECT * FROM wf_bullet_points ORDER BY seo_score DESC").all() as Array<{
    id: string; title: string; content: string; seo_score: number; rufus: number;
  }>;
  return rows.map((r) => ({
    id: r.id, title: r.title, content: r.content,
    seoScore: r.seo_score, rufus: r.rufus === 1,
  }));
}

export function getInfringementWords(): InfringementWord[] {
  const db = getDb();
  const rows = db.query("SELECT * FROM wf_infringement_words ORDER BY id").all() as Array<{
    word: string; type: string; risk: string; action: string;
  }>;
  return rows.map((r) => ({
    word: r.word, type: r.type as InfringementWord["type"],
    risk: r.risk, action: r.action,
  }));
}

// ========== 库存 ==========

export function getInventoryItems(filters?: {
  status?: string; page?: number; pageSize?: number;
}): PaginatedResult<InventoryItem> {
  let where = "WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.status) { where += " AND status = ?"; params.push(filters.status); }

  const result = paginatedQuery<{
    id: string; sku: string; name: string; stock: number; daily_sales: number;
    ratio_days: number; stockout_date: string | null; restock_qty: number;
    restock_date: string | null; status: string; trend: string;
    avg_cost: number; ship_days: number;
  }>("wf_inventory", where, params, filters?.page ?? 1, filters?.pageSize ?? 20);

  return {
    items: result.items.map((r) => ({
      id: r.id, sku: r.sku, name: r.name, stock: r.stock,
      dailySales: r.daily_sales, ratioDays: r.ratio_days,
      stockoutDate: r.stockout_date ?? "", restockQty: r.restock_qty,
      restockDate: r.restock_date ?? "-", status: r.status as InventoryItem["status"],
      trend: parseJsonField<number[]>(r.trend, []),
      avgCost: r.avg_cost, shipDays: r.ship_days,
    })),
    pagination: result.pagination,
  };
}

export function getRestockSuggestions(): RestockSuggestion[] {
  const db = getDb();
  const rows = db.query(
    `SELECT * FROM wf_inventory WHERE restock_qty > 0 ORDER BY ratio_days ASC`,
  ).all() as Array<{
    id: string; sku: string; name: string; restock_qty: number;
    ratio_days: number; restock_date: string | null; avg_cost: number; ship_days: number;
  }>;

  return rows.map((r) => ({
    id: `rs-${r.sku}`, sku: r.sku, name: r.name,
    suggestedQty: r.restock_qty,
    urgency: (r.ratio_days < 15 ? "high" : r.ratio_days < 30 ? "medium" : "low") as RestockSuggestion["urgency"],
    method: r.ship_days <= 25 ? "express" : "sea",
    eta: r.restock_date ?? "-",
    cost: Math.round(r.restock_qty * r.avg_cost * 0.6),
  }));
}

// ========== 竞品分析 ==========

export function getCompetitorKeywords(type?: string): KeywordItem[] {
  const db = getDb();
  let sql = "SELECT * FROM wf_competitor_keywords";
  const params: unknown[] = [];
  if (type) { sql += " WHERE type = ?"; params.push(type); }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = db.query(sql).all(...(params as any[])) as Array<{
    keyword: string; volume: number; competition: number; cpc: number; trend: string; type: string;
  }>;
  return rows.map((r) => ({
    keyword: r.keyword, volume: r.volume, competition: r.competition,
    cpc: r.cpc, trend: parseJsonField<number[]>(r.trend, []),
    type: r.type as KeywordItem["type"],
  }));
}

export function getCompetitors(): CompetitorEntry[] {
  const db = getDb();
  const rows = db.query("SELECT * FROM wf_competitors ORDER BY rank").all() as Array<{
    id: string; name: string; sp_count: number; sb_count: number;
    sd_count: number; keywords: number; rank: number; strategy: string;
  }>;
  return rows.map((r) => ({
    id: r.id, name: r.name, spCount: r.sp_count, sbCount: r.sb_count,
    sdCount: r.sd_count, keywords: r.keywords, rank: r.rank,
    strategy: r.strategy as CompetitorEntry["strategy"],
  }));
}

// ========== 工作流状态 ==========

export function getWorkflowStatuses(): WorkflowStatus[] {
  const db = getDb();
  const rows = db.query("SELECT * FROM wf_workflow_statuses ORDER BY id").all() as Array<{
    id: string; name: string; href: string; status: string;
    last_run: string | null; run_count: number; success_rate: number;
  }>;
  return rows.map((r) => ({
    id: r.id, name: r.name, href: r.href,
    status: r.status as WorkflowStatus["status"],
    lastRun: r.last_run ?? "", runs: r.run_count, success: r.success_rate,
  }));
}

export function updateWorkflowStatus(id: string, data: { status?: string; lastRun?: string; runCount?: number; successRate?: number }): void {
  const db = getDb();
  const sets: string[] = ["updated_at = datetime('now')"];
  const params: unknown[] = [];

  if (data.status !== undefined) { sets.push("status = ?"); params.push(data.status); }
  if (data.lastRun !== undefined) { sets.push("last_run = ?"); params.push(data.lastRun); }
  if (data.runCount !== undefined) { sets.push("run_count = ?"); params.push(data.runCount); }
  if (data.successRate !== undefined) { sets.push("success_rate = ?"); params.push(data.successRate); }

  params.push(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db.run(`UPDATE wf_workflow_statuses SET ${sets.join(", ")} WHERE id = ?`, params as any[]);
}

// ========== 生成结果: 广告分析 ==========

export function insertAdAnalysis(data: {
  id: string; keyword: string; currentData: unknown; resultJson: unknown;
}): void {
  const db = getDb();
  db.run(
    "INSERT INTO wf_ad_analyses (id, keyword, current_data, result_json) VALUES (?, ?, ?, ?)",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [data.id, data.keyword, JSON.stringify(data.currentData), JSON.stringify(data.resultJson)] as any[],
  );
}

export function getRecentAdAnalyses(limit = 10): Array<{ id: string; keyword: string; resultJson: unknown; createdAt: string }> {
  const db = getDb();
  const rows = db.query("SELECT * FROM wf_ad_analyses ORDER BY created_at DESC LIMIT ?").all(limit) as Array<{
    id: string; keyword: string; result_json: string; created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id, keyword: r.keyword,
    resultJson: parseJsonField(r.result_json, {}), createdAt: r.created_at,
  }));
}

// ========== 生成结果: 选品 ==========

export function insertResearchResult(data: {
  id: string; marketplace: string; category: string; keywords: string[]; sources: string[]; resultJson: unknown;
}): void {
  const db = getDb();
  db.run(
    "INSERT INTO wf_generated_research (id, marketplace, category, keywords, sources, result_json) VALUES (?, ?, ?, ?, ?, ?)",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [data.id, data.marketplace, data.category, JSON.stringify(data.keywords), JSON.stringify(data.sources), JSON.stringify(data.resultJson)] as any[],
  );
}

export function getRecentResearchResults(limit = 10): Array<{ id: string; marketplace: string; category: string; resultJson: unknown; createdAt: string }> {
  const db = getDb();
  const rows = db.query("SELECT * FROM wf_generated_research ORDER BY created_at DESC LIMIT ?").all(limit) as Array<{
    id: string; marketplace: string; category: string; result_json: string; created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id, marketplace: r.marketplace, category: r.category,
    resultJson: parseJsonField(r.result_json, {}), createdAt: r.created_at,
  }));
}

// ========== 生成结果: 上架 ==========

export function insertListingResult(data: {
  id: string; keyword: string; category: string; language: string;
  title: string; bullets: string[]; description: string; searchTerms: string[];
  seoScore: number; estimatedCtr: string; resultJson: unknown;
}): void {
  const db = getDb();
  db.run(
    "INSERT INTO wf_generated_listings (id, keyword, category, language, title, bullets, description, search_terms, seo_score, estimated_ctr, result_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [data.id, data.keyword, data.category, data.language, data.title, JSON.stringify(data.bullets), data.description, JSON.stringify(data.searchTerms), data.seoScore, data.estimatedCtr, JSON.stringify(data.resultJson)] as any[],
  );
}

export function getRecentListingResults(limit = 10): Array<{ id: string; keyword: string; title: string; resultJson: unknown; createdAt: string }> {
  const db = getDb();
  const rows = db.query("SELECT * FROM wf_generated_listings ORDER BY created_at DESC LIMIT ?").all(limit) as Array<{
    id: string; keyword: string; title: string; result_json: string; created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id, keyword: r.keyword, title: r.title,
    resultJson: parseJsonField(r.result_json, {}), createdAt: r.created_at,
  }));
}

// ========== 生成结果: 竞品分析 ==========

export function insertCompetitorAnalysis(data: {
  id: string; asins: string[]; marketplace: string; keywords: string[]; resultJson: unknown;
}): void {
  const db = getDb();
  db.run(
    "INSERT INTO wf_generated_competitor_analysis (id, asins, marketplace, keywords, result_json) VALUES (?, ?, ?, ?, ?)",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [data.id, JSON.stringify(data.asins), data.marketplace, JSON.stringify(data.keywords), JSON.stringify(data.resultJson)] as any[],
  );
}

export function getRecentCompetitorAnalyses(limit = 10): Array<{ id: string; asins: string[]; resultJson: unknown; createdAt: string }> {
  const db = getDb();
  const rows = db.query("SELECT * FROM wf_generated_competitor_analysis ORDER BY created_at DESC LIMIT ?").all(limit) as Array<{
    id: string; asins: string; result_json: string; created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id, asins: parseJsonField<string[]>(r.asins, []),
    resultJson: parseJsonField(r.result_json, {}), createdAt: r.created_at,
  }));
}

// ========== 生成结果: 补货订单 ==========

export function insertRestockOrder(data: { id: string; items: Array<{ sku: string; quantity: number; shipMethod: string }>; status: string }): void {
  const db = getDb();
  db.run(
    "INSERT INTO wf_restock_orders (id, items, status, total_items) VALUES (?, ?, ?, ?)",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [data.id, JSON.stringify(data.items), data.status, data.items.length] as any[],
  );
}

export function getRecentRestockOrders(limit = 10): Array<{ id: string; items: Array<{ sku: string; quantity: number; shipMethod: string }>; status: string; totalItems: number; createdAt: string }> {
  const db = getDb();
  const rows = db.query("SELECT * FROM wf_restock_orders ORDER BY created_at DESC LIMIT ?").all(limit) as Array<{
    id: string; items: string; status: string; total_items: number; created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    items: parseJsonField<Array<{ sku: string; quantity: number; shipMethod: string }>>(r.items, []),
    status: r.status, totalItems: r.total_items, createdAt: r.created_at,
  }));
}
