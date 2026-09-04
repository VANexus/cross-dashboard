/**
 * FlowMind RAK — AI Prompt Templates
 * Structured prompts for each workflow domain
 */

// ========== Product Research (选品) ==========

export function productResearchPrompt(params: {
  sources: string[];
  keywords?: string[];
  category?: string;
  marketplace?: string;
}): { system: string; prompt: string; schema: string } {
  return {
    system: "You are an expert cross-border e-commerce product research analyst. Analyze market data and provide actionable product recommendations. Always respond with valid JSON.",
    prompt: `Analyze the following product research request for ${params.marketplace ?? "US"} marketplace:

Sources: ${params.sources.join(", ")}
${params.keywords?.length ? `Keywords: ${params.keywords.join(", ")}` : ""}
${params.category ? `Category: ${params.category}` : ""}

Provide a comprehensive analysis including:
1. Top product recommendations with scores and reasoning
2. Market trend direction (upward/stable/downward)
3. Key pain points in this category
4. Supply-demand ratio assessment
5. Competition level analysis
6. Confidence score (0-1)`,
    schema: `{
  "recommendations": [{ "name": "string", "score": number, "reason": "string", "estimatedDemand": "string", "competitionLevel": "low|medium|high" }],
  "marketTrend": "upward|stable|downward",
  "painPoints": ["string"],
  "supplyDemandRatio": number,
  "competitionLevel": "low|medium|high",
  "confidence": number,
  "summary": "string"
}`,
  };
}

// ========== Listing Generation (商品发布) ==========

export function listingGenerationPrompt(params: {
  keyword?: string;
  sourceUrl?: string;
  category?: string;
  language?: string;
}): { system: string; prompt: string; schema: string } {
  const lang = params.language ?? "English";
  return {
    system: `You are an expert Amazon listing copywriter specializing in cross-border e-commerce. Generate high-converting product listings in ${lang}. Optimize for SEO and Amazon's A10 algorithm. Always respond with valid JSON.`,
    prompt: `Generate a complete Amazon product listing:

${params.keyword ? `Main Keyword: ${params.keyword}` : ""}
${params.category ? `Category: ${params.category}` : ""}
${params.sourceUrl ? `Reference: ${params.sourceUrl}` : ""}
Language: ${lang}

Requirements:
1. Title: Under 200 characters, keyword-rich, follow Amazon style guidelines
2. 5 Bullet Points: Each under 200 characters, start with benefit, include features
3. Description: 1000-2000 characters, HTML formatted, compelling copy
4. Backend Search Terms: 5 relevant search terms
5. Suggested category with confidence score`,
    schema: `{
  "title": "string",
  "bullets": ["string"],
  "description": "string (HTML formatted)",
  "searchTerms": ["string"],
  "category": { "name": "string", "confidence": number },
  "seoScore": number,
  "estimatedCTR": "string"
}`,
  };
}

// ========== Ad Optimization (广告) ==========

export function adOptimizationPrompt(params: {
  keywords?: string[];
  asin?: string;
  marketplace?: string;
  budget?: number;
}): { system: string; prompt: string; schema: string } {
  return {
    system: "You are an Amazon PPC advertising expert. Analyze keywords and provide bid optimization strategies. Always respond with valid JSON.",
    prompt: `Optimize Amazon PPC advertising strategy:

${params.asin ? `ASIN: ${params.asin}` : ""}
${params.keywords?.length ? `Target Keywords: ${params.keywords.join(", ")}` : ""}
${params.marketplace ? `Marketplace: ${params.marketplace}` : ""}
${params.budget ? `Daily Budget: $${params.budget}` : ""}

Provide:
1. Keyword suggestions with match types (broad/phrase/exact)
2. Bid recommendations (low/medium/high)
3. Estimated ACOS for each keyword
4. Negative keyword suggestions
5. Campaign structure recommendations`,
    schema: `{
  "keywords": [{ "keyword": "string", "matchType": "broad|phrase|exact", "suggestedBid": number, "estimatedACOS": number, "priority": "high|medium|low" }],
  "negativeKeywords": ["string"],
  "campaignStructure": { "type": "string", "budgetAllocation": "string" },
  "estimatedACOS": number,
  "recommendations": ["string"]
}`,
  };
}

// ========== Competitor Analysis (竞品分析) ==========

export function competitorAnalysisPrompt(params: {
  asins: string[];
  marketplace?: string;
  keywords?: string[];
}): { system: string; prompt: string; schema: string } {
  return {
    system: "You are an Amazon competitive intelligence analyst. Analyze competitor products and provide strategic insights. Always respond with valid JSON.",
    prompt: `Perform competitive analysis for the following products:

ASINs: ${params.asins.join(", ")}
${params.marketplace ? `Marketplace: ${params.marketplace}` : ""}
${params.keywords?.length ? `Focus Keywords: ${params.keywords.join(", ")}` : ""}

Analyze and provide:
1. Competitor strengths and weaknesses
2. Pricing strategy assessment
3. Keyword gap analysis
4. Review sentiment summary
5. Recommended differentiation strategies
6. Estimated market share`,
    schema: `{
  "competitors": [{ "asin": "string", "strengths": ["string"], "weaknesses": ["string"], "priceRange": { "low": number, "high": number, "avg": number }, "estimatedRating": number, "estimatedReviews": number }],
  "keywordGaps": [{ "keyword": "string", "opportunity": "high|medium|low" }],
  "differentiationStrategies": ["string"],
  "marketShare": [{ "asin": "string", "percentage": number }],
  "summary": "string"
}`,
  };
}

// ========== Ad Keyword Analysis (广告关键词分析) ==========

export function adKeywordAnalysisPrompt(params: {
  keyword: string;
  currentData: {
    impressions: number;
    clicks: number;
    spend: number;
    sales: number;
    acos: number;
  };
}): { system: string; prompt: string; schema: string } {
  return {
    system: "You are an Amazon PPC optimization expert. Analyze keyword performance data and provide actionable recommendations. Always respond with valid JSON.",
    prompt: `Analyze this Amazon PPC keyword performance:

Keyword: "${params.keyword}"
- Impressions: ${params.currentData.impressions}
- Clicks: ${params.currentData.clicks}
- Spend: $${params.currentData.spend}
- Sales: $${params.currentData.sales}
- ACOS: ${params.currentData.acos}%

Provide:
1. Performance assessment (excellent/good/average/poor)
2. Recommended action (increase_bid/maintain/decrease_bid/pause)
3. Suggested bid adjustment percentage
4. Optimization tips specific to this keyword`,
    schema: `{
  "assessment": "excellent|good|average|poor",
  "action": "increase_bid|maintain|decrease_bid|pause",
  "bidAdjustment": number,
  "tips": ["string"],
  "estimatedImpact": { "newACOS": number, "projectedSales": number }
}`,
  };
}
