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
} from "@/lib/shared/types";

export class WorkflowService {
  // ========== 选品 ==========

  async getDataSources(): Promise<DataSource[]> {
    return await repo.getDataSources();
  }

  async getProductKeywords(marketplace?: string): Promise<ProductKeyword[]> {
    return await repo.getProductKeywords(marketplace);
  }

  async getPainPoints(): Promise<PainPoint[]> {
    return await repo.getPainPoints();
  }

  async getRecentResearchResults(limit?: number) {
    return await repo.getRecentResearchResults(limit);
  }

  async executeResearch(data: {
    sources: string[];
    keywords?: string[];
    category?: string;
    marketplace?: string;
  }): Promise<{ id: string; status: string; estimatedTime: number; result?: unknown }> {
    const id = `research-${Date.now()}`;
    this.bumpWorkflowStatus("product-research", "running").catch(console.error);

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

      const provider = await getAIProvider();
      const { prompt, schema } = productResearchPrompt(data);
      const analysisPrompt = `${prompt}\n\n实际采集数据：\n${JSON.stringify(crawledData, null, 2)}`;
      const result = await provider.analyze({ prompt: analysisPrompt, data: {}, schema });

      repo.insertResearchResult({
        id, marketplace: data.marketplace ?? "US",
        category: data.category ?? "", keywords: data.keywords ?? [],
        sources: data.sources, resultJson: result,
      }).catch(console.error);

      this.bumpWorkflowStatus("product-research", "idle").catch(console.error);
      return { id, status: "completed", estimatedTime: 0, result };
    } catch (error) {
      this.bumpWorkflowStatus("product-research", "idle").catch(console.error);
      throw error;
    }
  }

  // ========== AI 制图 ==========

  async getImages(type?: string): Promise<GeneratedImg[]> {
    return await repo.getImages(type);
  }

  async updateImage(id: string, data: Partial<GeneratedImg>): Promise<GeneratedImg | null> {
    return await repo.updateImage(id, data);
  }

  async getStoryboardFrames(): Promise<StoryboardFrame[]> {
    return await repo.getStoryboardFrames();
  }

  async generateImage(data: {
    type: string;
    prompt: string;
    model?: string;
    style?: string;
    count?: number;
  }): Promise<{ id: string; status: string; estimatedTime: number; result?: unknown }> {
    const id = `gen-${Date.now()}`;
    this.bumpWorkflowStatus("ai-imaging", "running").catch(console.error);

    try {
      const aiCfg = await getAIConfig();
      // 生图统一走 AI_IMAGE_*（与 content.selfhost.generateImages 同源，避免 IMAGE_*/LLM baseUrl 分裂）。
      // 未配 AI_IMAGE_* 时兜底用 IMAGE_*，再兜底 LLM 网关——保证哪条配置在都能出图。
      const imageApiKey =
        process.env.AI_IMAGE_API_KEY?.trim() ||
        process.env.IMAGE_API_KEY ||
        aiCfg.apiKey;
      const imageBaseUrl =
        process.env.AI_IMAGE_API_URL?.trim() ||
        process.env.IMAGE_BASE_URL ||
        aiCfg.baseUrl;
      const imageModel =
        process.env.AI_IMAGE_MODEL?.trim() ||
        process.env.IMAGE_MODEL ||
        data.model ||
        aiCfg.model;

      if (!imageApiKey || !imageBaseUrl) {
        throw new Error("图片生成 API 未配置。请在 .env/.env.local 中设置 AI_IMAGE_API_KEY / AI_IMAGE_API_URL。");
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
        model: imageModel,
      });

      for (const img of results) {
        repo.insertImage({
          id: `${id}-${results.indexOf(img)}`,
          type: data.type,
          url: img.url || "",
          prompt: data.prompt,
          model: img.model || imageModel || "unknown",
          revisedPrompt: img.revisedPrompt,
        }).catch(console.error);
      }

      this.bumpWorkflowStatus("ai-imaging", "idle").catch(console.error);
      return { id, status: "completed", estimatedTime: 0, result: results };
    } catch (error) {
      this.bumpWorkflowStatus("ai-imaging", "idle").catch(console.error);
      throw error;
    }
  }

  // ========== 广告 ==========

  async getAdKeywords(filters?: { type?: string; tag?: string }): Promise<AdKeyword[]> {
    return await repo.getAdKeywords(filters);
  }

  async updateAdKeyword(id: string, data: Partial<AdKeyword>): Promise<AdKeyword | null> {
    return await repo.updateAdKeyword(id, data);
  }

  async getAdPositions(): Promise<AdPosition[]> {
    return await repo.getAdPositions();
  }

  exportAdData(): { url: string; format: string } {
    return { url: "/exports/ad-data.csv", format: "csv" };
  }

  async getRecentAdAnalyses(limit?: number) {
    return await repo.getRecentAdAnalyses(limit);
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
    this.bumpWorkflowStatus("ai-advertising", "running").catch(console.error);

    try {
      const provider = await getAIProvider();
      const { prompt, schema } = adKeywordAnalysisPrompt(data);
      const result = await provider.analyze({ prompt, data: {}, schema });

      repo.insertAdAnalysis({
        id, keyword: data.keyword,
        currentData: data.currentData, resultJson: result,
      }).catch(console.error);

      this.bumpWorkflowStatus("ai-advertising", "idle").catch(console.error);
      return { id, status: "completed", result };
    } catch (error) {
      this.bumpWorkflowStatus("ai-advertising", "idle").catch(console.error);
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
    this.bumpWorkflowStatus("ai-advertising", "running").catch(console.error);

    try {
      const provider = await getAIProvider();
      const { prompt, schema } = adOptimizationPrompt(data);
      const result = await provider.analyze({ prompt, data: {}, schema });
      this.bumpWorkflowStatus("ai-advertising", "idle").catch(console.error);
      return { id, status: "completed", result };
    } catch (error) {
      this.bumpWorkflowStatus("ai-advertising", "idle").catch(console.error);
      throw error;
    }
  }

  // ========== 商品发布 ==========

  async getCategoryRecs(): Promise<CategoryRec[]> {
    return await repo.getCategoryRecs();
  }

  async getBulletPoints(): Promise<BulletPoint[]> {
    return await repo.getBulletPoints();
  }

  async getInfringementWords(): Promise<InfringementWord[]> {
    return await repo.getInfringementWords();
  }

  async getRecentListingResults(limit?: number) {
    return await repo.getRecentListingResults(limit);
  }

  async generateListing(data: {
    keyword?: string;
    sourceUrl?: string;
    category?: string;
    language?: string;
  }): Promise<{ id: string; status: string; estimatedTime: number; result?: unknown }> {
    const id = `listing-${Date.now()}`;
    this.bumpWorkflowStatus("ai-listing", "running").catch(console.error);

    try {
      const provider = await getAIProvider();
      const { prompt, schema } = listingGenerationPrompt(data);
      const result = await provider.analyze({ prompt, data: {}, schema });

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
      }).catch(console.error);

      this.bumpWorkflowStatus("ai-listing", "idle").catch(console.error);
      return { id, status: "completed", estimatedTime: 0, result };
    } catch (error) {
      this.bumpWorkflowStatus("ai-listing", "idle").catch(console.error);
      throw error;
    }
  }

  publishListing(_data: {
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

  async getInventoryItems(filters?: {
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: InventoryItem[]; pagination: Pagination }> {
    return await repo.getInventoryItems(filters);
  }

  async getRestockSuggestions(): Promise<RestockSuggestion[]> {
    return await repo.getRestockSuggestions();
  }

  async generateRestockSuggestions(): Promise<{ id: string; status: string; result?: unknown }> {
    const id = `restock-${Date.now()}`;
    this.bumpWorkflowStatus("inventory", "running").catch(console.error);

    try {
      const provider = await getAIProvider();
      const inventory = await repo.getInventoryItems({ status: "warning" });
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
      this.bumpWorkflowStatus("inventory", "idle").catch(console.error);
      return { id, status: "completed", result };
    } catch (error) {
      this.bumpWorkflowStatus("inventory", "idle").catch(console.error);
      throw error;
    }
  }

  async getRecentRestockOrders(limit?: number) {
    return await repo.getRecentRestockOrders(limit);
  }

  async createRestockOrder(items: {
    sku: string;
    quantity: number;
    shipMethod: string;
  }[]): Promise<{ orderId: string; status: string; items: number }> {
    const orderId = `PO-${Date.now()}`;
    repo.insertRestockOrder({ id: orderId, items, status: "created" }).catch(console.error);
    return { orderId, status: "created", items: items.length };
  }

  // ========== 竞品分析 ==========

  async getCompetitorKeywords(type?: string): Promise<KeywordItem[]> {
    return await repo.getCompetitorKeywords(type);
  }

  async getCompetitors(): Promise<CompetitorEntry[]> {
    return await repo.getCompetitors();
  }

  async getRecentCompetitorAnalyses(limit?: number) {
    return await repo.getRecentCompetitorAnalyses(limit);
  }

  async analyzeCompetitor(data: {
    asins: string[];
    marketplace?: string;
    keywords?: string[];
  }): Promise<{ id: string; status: string; estimatedTime: number; result?: unknown }> {
    const id = `analysis-${Date.now()}`;
    this.bumpWorkflowStatus("competitor-ads", "running").catch(console.error);

    try {
      const provider = await getAIProvider();
      const { prompt, schema } = competitorAnalysisPrompt(data);
      const result = await provider.analyze({ prompt, data: {}, schema });

      repo.insertCompetitorAnalysis({
        id, asins: data.asins,
        marketplace: data.marketplace ?? "US",
        keywords: data.keywords ?? [],
        resultJson: result,
      }).catch(console.error);

      this.bumpWorkflowStatus("competitor-ads", "idle").catch(console.error);
      return { id, status: "completed", estimatedTime: 0, result };
    } catch (error) {
      this.bumpWorkflowStatus("competitor-ads", "idle").catch(console.error);
      throw error;
    }
  }

  // ========== 工作流状态 ==========

  async getWorkflowStatuses(): Promise<WorkflowStatus[]> {
    return await repo.getWorkflowStatuses();
  }

  private async bumpWorkflowStatus(workflowId: string, status: "running" | "idle") {
    try {
      const current = (await repo.getWorkflowStatuses()).find((w) => w.id === workflowId);
      const newRuns = (current?.runs ?? 0) + (status === "idle" ? 1 : 0);
      await repo.updateWorkflowStatus(workflowId, {
        status,
        lastRun: status === "idle" ? new Date().toISOString() : undefined,
        runCount: newRuns,
      });
    } catch {
      // Non-critical — don't fail the workflow
    }
  }
}
