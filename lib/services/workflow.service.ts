/**
 * FlowMind RAK — Workflow Service
 * Business logic for all 6 workflows
 */
import * as repo from "../repositories/workflow.repository";
import { getAIProvider, getAIConfig } from "../ai";
import {
  productResearchPrompt,
  listingGenerationPrompt,
  competitorAnalysisPrompt,
  adOptimizationPrompt,
  adKeywordAnalysisPrompt,
} from "../ai/prompts";
import { ImageGenerator } from "../image-gen";
import { AmazonCrawler } from "../crawlers";
import type {
  DataSource, ProductKeyword, PainPoint, GeneratedImg,
  StoryboardFrame, AdKeyword, CategoryRec, BulletPoint,
  InfringementWord, InventoryItem, RestockSuggestion,
  KeywordItem, CompetitorEntry, AdPosition, WorkflowStatus,
  Pagination,
} from "../types";

export class WorkflowService {
  // ========== 选品 ==========

  getDataSources(): DataSource[] {
    return repo.getDataSources();
  }

  getProductKeywords(marketplace?: string): ProductKeyword[] {
    return repo.getProductKeywords(marketplace);
  }

  getPainPoints(): PainPoint[] {
    return repo.getPainPoints();
  }

  getRecentResearchResults(limit?: number) {
    return repo.getRecentResearchResults(limit);
  }

  async executeResearch(data: {
    sources: string[];
    keywords?: string[];
    category?: string;
    marketplace?: string;
  }): Promise<{ id: string; status: string; estimatedTime: number; result?: unknown }> {
    const id = `research-${Date.now()}`;
    this.bumpWorkflowStatus("product-research", "running");

    try {
      const crawler = new AmazonCrawler(data.marketplace || "US");
      const crawledData: unknown[] = [];

      if (data.keywords?.length) {
        for (const keyword of data.keywords.slice(0, 3)) {
          const result = await crawler.searchProducts(keyword);
          if (result.success) {
            crawledData.push(...result.data.slice(0, 5));
          }
        }
      }

      const provider = getAIProvider();
      const { prompt, schema } = productResearchPrompt(data);
      const analysisPrompt = `${prompt}\n\n实际采集数据：\n${JSON.stringify(crawledData, null, 2)}`;
      const result = await provider.analyze({ prompt: analysisPrompt, data: {}, schema });

      repo.insertResearchResult({
        id, marketplace: data.marketplace ?? "US",
        category: data.category ?? "", keywords: data.keywords ?? [],
        sources: data.sources, resultJson: result,
      });

      this.bumpWorkflowStatus("product-research", "idle");
      return { id, status: "completed", estimatedTime: 0, result };
    } catch (error) {
      this.bumpWorkflowStatus("product-research", "idle");
      throw error;
    }
  }

  // ========== AI 制图 ==========

  getImages(type?: string): GeneratedImg[] {
    return repo.getImages(type);
  }

  updateImage(id: string, data: Partial<GeneratedImg>): GeneratedImg | null {
    return repo.updateImage(id, data);
  }

  getStoryboardFrames(): StoryboardFrame[] {
    return repo.getStoryboardFrames();
  }

  async generateImage(data: {
    type: string;
    prompt: string;
    model?: string;
    style?: string;
    count?: number;
  }): Promise<{ id: string; status: string; estimatedTime: number; result?: unknown }> {
    const id = `gen-${Date.now()}`;
    this.bumpWorkflowStatus("ai-imaging", "running");

    try {
      const imageApiKey = process.env.IMAGE_API_KEY || getAIConfig().apiKey;
      const imageBaseUrl = process.env.IMAGE_BASE_URL || getAIConfig().baseUrl;
      const imageModel = process.env.IMAGE_MODEL || data.model;

      if (!imageApiKey) {
        throw new Error("图片生成 API Key 未配置。请在 .env.local 中设置 IMAGE_API_KEY。");
      }

      const generator = new ImageGenerator({
        apiKey: imageApiKey,
        baseUrl: imageBaseUrl,
        model: imageModel,
      });

      const results = await generator.generate({
        prompt: data.prompt,
        type: data.type as "main" | "scene" | "aplus",
        style: data.style as "realistic" | "artistic" | "minimalist",
        count: data.count,
        model: data.model,
      });

      // Persist each generated image to DB
      for (const img of results) {
        repo.insertImage({
          id: `${id}-${results.indexOf(img)}`,
          type: data.type,
          url: img.url || "",
          prompt: data.prompt,
          model: img.model || imageModel || "unknown",
          revisedPrompt: img.revisedPrompt,
        });
      }

      this.bumpWorkflowStatus("ai-imaging", "idle");
      return { id, status: "completed", estimatedTime: 0, result: results };
    } catch (error) {
      this.bumpWorkflowStatus("ai-imaging", "idle");
      throw error;
    }
  }

  // ========== 广告 ==========

  getAdKeywords(filters?: { type?: string; tag?: string }): AdKeyword[] {
    return repo.getAdKeywords(filters);
  }

  updateAdKeyword(id: string, data: Partial<AdKeyword>): AdKeyword | null {
    return repo.updateAdKeyword(id, data);
  }

  getAdPositions(): AdPosition[] {
    return repo.getAdPositions();
  }

  exportAdData(): { url: string; format: string } {
    return { url: "/exports/ad-data.csv", format: "csv" };
  }

  getRecentAdAnalyses(limit?: number) {
    return repo.getRecentAdAnalyses(limit);
  }

  async analyzeAdKeyword(data: {
    keyword: string;
    currentData: {
      impressions: number;
      clicks: number;
      spend: number;
      sales: number;
      acos: number;
    };
  }): Promise<{ id: string; status: string; result?: unknown }> {
    const id = `ad-analysis-${Date.now()}`;
    this.bumpWorkflowStatus("ai-advertising", "running");

    try {
      const provider = getAIProvider();
      const { prompt, schema } = adKeywordAnalysisPrompt(data);
      const result = await provider.analyze({ prompt, data: {}, schema });

      repo.insertAdAnalysis({
        id, keyword: data.keyword,
        currentData: data.currentData, resultJson: result,
      });

      this.bumpWorkflowStatus("ai-advertising", "idle");
      return { id, status: "completed", result };
    } catch (error) {
      this.bumpWorkflowStatus("ai-advertising", "idle");
      throw error;
    }
  }

  async optimizeAdStrategy(data: {
    keywords?: string[];
    asin?: string;
    marketplace?: string;
    budget?: number;
  }): Promise<{ id: string; status: string; result?: unknown }> {
    const id = `ad-optimize-${Date.now()}`;
    this.bumpWorkflowStatus("ai-advertising", "running");

    try {
      const provider = getAIProvider();
      const { prompt, schema } = adOptimizationPrompt(data);
      const result = await provider.analyze({ prompt, data: {}, schema });
      this.bumpWorkflowStatus("ai-advertising", "idle");
      return { id, status: "completed", result };
    } catch (error) {
      this.bumpWorkflowStatus("ai-advertising", "idle");
      throw error;
    }
  }

  // ========== 商品发布 ==========

  getCategoryRecs(): CategoryRec[] {
    return repo.getCategoryRecs();
  }

  getBulletPoints(): BulletPoint[] {
    return repo.getBulletPoints();
  }

  getInfringementWords(): InfringementWord[] {
    return repo.getInfringementWords();
  }

  getRecentListingResults(limit?: number) {
    return repo.getRecentListingResults(limit);
  }

  async generateListing(data: {
    keyword?: string;
    sourceUrl?: string;
    category?: string;
    language?: string;
  }): Promise<{ id: string; status: string; estimatedTime: number; result?: unknown }> {
    const id = `listing-${Date.now()}`;
    this.bumpWorkflowStatus("ai-listing", "running");

    try {
      const provider = getAIProvider();
      const { prompt, schema } = listingGenerationPrompt(data);
      const result = await provider.analyze({ prompt, data: {}, schema });

      // Persist listing result
      const r = result as Record<string, unknown>;
      repo.insertListingResult({
        id,
        keyword: data.keyword ?? "",
        category: data.category ?? "",
        language: data.language ?? "en",
        title: (r.title as string) ?? "",
        bullets: (r.bullets as string[]) ?? [],
        description: (r.description as string) ?? "",
        searchTerms: (r.searchTerms as string[]) ?? [],
        seoScore: (r.seoScore as number) ?? 0,
        estimatedCtr: (r.estimatedCTR as string) ?? "",
        resultJson: result,
      });

      this.bumpWorkflowStatus("ai-listing", "idle");
      return { id, status: "completed", estimatedTime: 0, result };
    } catch (error) {
      this.bumpWorkflowStatus("ai-listing", "idle");
      throw error;
    }
  }

  publishListing(data: {
    title: string;
    bulletPoints: { title: string; desc: string }[];
    description: string;
    categoryId: string;
    images: string[];
  }): { success: boolean; listingId: string } {
    return {
      success: true,
      listingId: `lst-${Date.now()}`,
    };
  }

  // ========== 库存 ==========

  getInventoryItems(filters?: {
    status?: string;
    page?: number;
    pageSize?: number;
  }): { items: InventoryItem[]; pagination: Pagination } {
    return repo.getInventoryItems(filters);
  }

  getRestockSuggestions(): RestockSuggestion[] {
    return repo.getRestockSuggestions();
  }

  async generateRestockSuggestions(): Promise<{ id: string; status: string; result?: unknown }> {
    const id = `restock-${Date.now()}`;
    this.bumpWorkflowStatus("inventory", "running");

    try {
      const provider = getAIProvider();
      const inventory = repo.getInventoryItems({ status: "warning" });
      const prompt = `基于以下库存数据，生成补货建议：
${JSON.stringify(inventory.items, null, 2)}

要求：
1. 优先处理库存天数低于30天的商品
2. 考虑销售趋势和季节性因素
3. 计算最优补货数量（EOQ模型）
4. 估算补货成本和紧急程度`;

      const schema = `{
        "suggestions": [{ "sku": "string", "quantity": number, "urgency": "high|medium|low", "reason": "string", "estimatedCost": number }],
        "totalCost": number,
        "estimatedSavings": number
      }`;

      const result = await provider.analyze({ prompt, data: {}, schema });
      this.bumpWorkflowStatus("inventory", "idle");
      return { id, status: "completed", result };
    } catch (error) {
      this.bumpWorkflowStatus("inventory", "idle");
      throw error;
    }
  }

  getRecentRestockOrders(limit?: number) {
    return repo.getRecentRestockOrders(limit);
  }

  createRestockOrder(items: {
    sku: string;
    quantity: number;
    shipMethod: string;
  }[]): { orderId: string; status: string; items: number } {
    const orderId = `PO-${Date.now()}`;
    repo.insertRestockOrder({ id: orderId, items, status: "created" });
    return { orderId, status: "created", items: items.length };
  }

  // ========== 竞品分析 ==========

  getCompetitorKeywords(type?: string): KeywordItem[] {
    return repo.getCompetitorKeywords(type);
  }

  getCompetitors(): CompetitorEntry[] {
    return repo.getCompetitors();
  }

  getRecentCompetitorAnalyses(limit?: number) {
    return repo.getRecentCompetitorAnalyses(limit);
  }

  async analyzeCompetitor(data: {
    asins: string[];
    marketplace?: string;
    keywords?: string[];
  }): Promise<{ id: string; status: string; estimatedTime: number; result?: unknown }> {
    const id = `analysis-${Date.now()}`;
    this.bumpWorkflowStatus("competitor-ads", "running");

    try {
      const provider = getAIProvider();
      const { prompt, schema } = competitorAnalysisPrompt(data);
      const result = await provider.analyze({ prompt, data: {}, schema });

      repo.insertCompetitorAnalysis({
        id, asins: data.asins,
        marketplace: data.marketplace ?? "US",
        keywords: data.keywords ?? [],
        resultJson: result,
      });

      this.bumpWorkflowStatus("competitor-ads", "idle");
      return { id, status: "completed", estimatedTime: 0, result };
    } catch (error) {
      this.bumpWorkflowStatus("competitor-ads", "idle");
      throw error;
    }
  }

  // ========== 工作流状态 ==========

  getWorkflowStatuses(): WorkflowStatus[] {
    return repo.getWorkflowStatuses();
  }

  private bumpWorkflowStatus(workflowId: string, status: "running" | "idle") {
    try {
      const current = repo.getWorkflowStatuses().find((w) => w.id === workflowId);
      const newRuns = (current?.runs ?? 0) + (status === "idle" ? 1 : 0);
      repo.updateWorkflowStatus(workflowId, {
        status,
        lastRun: status === "idle" ? new Date().toISOString() : undefined,
        runCount: newRuns,
      });
    } catch {
      // Non-critical — don't fail the workflow
    }
  }
}
