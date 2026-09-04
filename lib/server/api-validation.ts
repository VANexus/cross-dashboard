import { z, type ZodSchema } from "zod";

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) return { success: false, error: result.error.issues.map((i) => i.message).join(", ") };
  return { success: true, data: result.data };
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(""),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  assignedAgents: z.array(z.string()).default([]),
});

export const updateTaskSchema = z.object({
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  output: z.string().optional(),
});

export const updateStepSchema = z.object({
  status: z.enum(["pending", "running", "completed", "failed"]).optional(),
  output: z.string().optional(),
});

export const createMemorySchema = z.object({
  zone: z.enum(["preset", "dev", "prompt", "agent"]),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  type: z.enum(["script", "code", "prompt", "skill", "insight"]),
  tags: z.array(z.string()).default([]),
  agentId: z.string().optional(),
});

export const updateMemorySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  type: z.enum(["script", "code", "prompt", "skill", "insight"]).optional(),
  tags: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
});

export const createRiskEventSchema = z.object({
  level: z.enum(["safe", "level3", "level2", "level1"]),
  title: z.string().min(1).max(200),
  description: z.string().max(1000),
  source: z.string().min(1),
  actions: z.array(z.string()).default([]),
});

export const updateRiskEventSchema = z.object({
  resolved: z.boolean().optional(),
  resolvedAt: z.string().optional(),
});

export const createEvolutionSchema = z.object({
  stage: z.enum(["identify", "generate", "test", "review", "reuse"]),
  title: z.string().min(1).max(200),
  description: z.string().max(1000),
  agentId: z.string().min(1),
});

export const updateEvolutionSchema = z.object({
  status: z.enum(["in_progress", "success", "failed"]).optional(),
  metrics: z
    .object({
      accuracy: z.number().min(0).max(100),
      latency: z.number().min(0),
      coverage: z.number().min(0).max(100),
    })
    .optional(),
  completedAt: z.string().optional(),
});

export const updateAdKeywordSchema = z.object({
  cpc: z.number().min(0).optional(),
  tag: z.enum(["high-acos", "high-conversion", "non-precise"]).optional(),
});

export const generateImageSchema = z.object({
  type: z.enum(["main", "scene", "aplus"]),
  prompt: z.string().min(1),
  model: z.string().optional(),
  style: z.string().optional(),
  count: z.number().int().min(1).max(4).default(1),
});

export const updateImageSchema = z.object({
  isBest: z.boolean().optional(),
});

export const generateListingSchema = z.object({
  keyword: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  category: z.string().optional(),
  language: z.enum(["en", "ja", "de", "fr"]).default("en"),
});

export const publishListingSchema = z.object({
  title: z.string().min(1),
  bulletPoints: z.array(
    z.object({
      title: z.string(),
      desc: z.string(),
    })
  ),
  description: z.string(),
  categoryId: z.string(),
  images: z.array(z.string().url()),
});

export const executeResearchSchema = z.object({
  sources: z.array(z.string()).min(1),
  keywords: z.array(z.string()).optional(),
  category: z.string().optional(),
  marketplace: z.enum(["US", "UK", "DE", "JP"]).default("US"),
});

export const createRestockOrderSchema = z.object({
  items: z.array(
    z.object({
      sku: z.string(),
      quantity: z.number().int().min(1),
      shipMethod: z.enum(["sea", "air", "express"]).default("sea"),
    })
  ),
});

export const analyzeCompetitorSchema = z.object({
  asins: z.array(z.string()).min(1).max(20),
  marketplace: z.enum(["US", "UK", "DE", "JP"]).default("US"),
  keywords: z.array(z.string()).optional(),
});

export const updateIsolationSchema = z.object({
  index: z.number().int().min(0).max(5),
  checked: z.boolean(),
});

// Workflow: 视频本地化
export const submitLocalizeBatchSchema = z.object({
  videoPaths: z.array(z.string().min(1)).min(1),
  targetLang: z.string().min(2).max(8).optional(),
  sourceLang: z.string().min(2).max(8).optional(),
  enableTts: z.boolean().optional(),
  removeSubtitles: z.boolean().optional(),
});

// Workflow: 内容创作中心
const contentPlatform = z.enum(["xhs", "wechat", "douyin"]);

export const contentIdeaSchema = z.object({
  platform: contentPlatform,
  subject: z.string().min(1).max(200),
  count: z.number().int().min(1).max(6).optional(),
});

export const contentHotSchema = z.object({
  platform: contentPlatform,
  refresh: z.boolean().optional(),
});

export const contentCopySchema = z.object({
  platform: contentPlatform,
  subject: z.string().min(1).max(200),
  angle: z.string().max(100).optional(),
  tone: z.string().max(200).optional(),
  keywords: z.array(z.string().max(40)).max(10).optional(),
});

export const contentAuditSchema = z.object({
  id: z.string().min(1),
});

export const contentImageSchema = z.object({
  draftId: z.string().min(1),
  platform: contentPlatform,
  prompt: z.string().min(1).max(2000),
  count: z.number().int().min(1).max(4).optional(),
});

export const updateDraftSchema = z.object({
  title: z.string().max(300).optional(),
  body: z.string().max(5000).optional(),
  tags: z.array(z.string().max(40)).max(10).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

// Workflow: B端运营工作台
const b2bTrendPlatform = z.enum(["tiktok", "instagram", "alibaba"]);
const b2bPreference = z.enum(["social", "alibaba", "mix"]);

export const b2bKeywordTrendSchema = z.object({
  platform: b2bTrendPlatform,
  industryId: z.number().int().positive().optional(),
  keyword: z.string().max(100).optional(),
  refresh: z.boolean().optional(),
});

/** 渠道账号保险库（M2） */
export const b2bChannelCreateSchema = z.object({
  platform: z.enum(["tiktok", "instagram", "alibaba"]),
  label: z.string().max(80).optional().default(""),
  /** 手动粘贴导入的会话（TikHub 主路径下仅作备用凭证） */
  session: z.string().min(10).max(20_000).optional(),
});

export const b2bChannelUpdateSchema = z.object({
  label: z.string().max(80).optional(),
  session: z.string().min(10).max(20_000).optional(),
  status: z.enum(["active", "expired", "risk_control"]).optional(),
});

export const b2bLongtailSchema = z.object({
  industry: z.string().min(1).max(100),
  seedKeywords: z.array(z.string().max(100)).max(20).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const b2bProductsSchema = z.object({
  refresh: z.boolean().optional(),
});

export const b2bRecommendSchema = z.object({
  preference: b2bPreference,
  trendKeywords: z.array(z.record(z.string(), z.unknown())).optional(),
  longtailKeywords: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const b2bListingGenerateSchema = z.object({
  productId: z.string().min(1),
  subject: z.string().max(200).optional(),
  keyword: z.string().max(100).optional(),
  preference: b2bPreference.default("alibaba"),
});

export const b2bListingPublishSchema = z.object({
  listingId: z.string().min(1),
});

export const b2bImageSkillTemplateType = z.enum(["", "主图", "详情页", "社媒", "其他"]);

export const b2bImageSkillCreateSchema = z.object({
  name: z.string().min(1).max(100),
  coverUrl: z.string().max(2000).default(""),
  reversedPrompt: z.string().min(1).max(4000),
  styleTags: z.array(z.string().max(40)).max(20).default([]),
  aspectRatio: z.string().max(10).default("1:1"),
  platform: z.string().max(40).optional(),
  templateType: b2bImageSkillTemplateType.default(""),
  isBuiltin: z.boolean().default(false),
});

export const b2bImageSkillUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  reversedPrompt: z.string().min(1).max(4000).optional(),
  styleTags: z.array(z.string().max(40)).max(20).optional(),
  aspectRatio: z.string().max(10).optional(),
  templateType: b2bImageSkillTemplateType.optional(),
});

export const b2bReversePromptSchema = z.object({
  imageUrl: z.string().min(1).max(2000),
  hint: z.string().max(500).optional(),
});

export const b2bImageGenSchema = z.object({
  skillId: z.string().min(1),
  prompt: z.string().max(2000).optional(),
});

// ── TikHub 情报中心 ──

export const adIntelSchema = z.object({
  action: z.enum(["search_ads", "filters", "locations", "hashtag_detail"]),
  keyword: z.string().max(120).optional(),
  hashtagId: z.string().max(64).optional(),
  period: z.number().int().positive().max(365).optional(),
  objective: z.number().int().optional(),
  industry: z.string().max(32).optional(),
  countryCode: z.string().max(8).optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  orderBy: z.enum(["for_you", "likes"]).optional(),
  timeRange: z.number().int().optional(),
});

export const shopIntelSchema = z.object({
  action: z.enum(["search", "suggest", "categories", "detail", "reviews", "seller"]),
  keyword: z.string().max(120).optional(),
  productId: z.string().max(64).optional(),
  sellerId: z.string().max(64).optional(),
  region: z.string().max(8).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  offset: z.number().int().min(0).optional(),
  page: z.number().int().positive().optional(),
});

export const contentIntelSchema = z.object({
  action: z.enum([
    "trending_words", "video_search", "music_chart",
    "creator_insights", "creator_profile", "ig_hashtag_posts",
  ]),
  keyword: z.string().max(120).optional(),
  uniqueId: z.string().max(120).optional(),
  withCountry: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  region: z.string().max(8).optional(),
  feedType: z.enum(["top", "recent"]).optional(),
});

// Workflow: 微信公众号端到端发布（M3）
export const wechatAccountCreateSchema = z.object({
  label: z.string().max(80).optional().default(""),
  appId: z.string().min(6).max(128),
  appSecret: z.string().min(6).max(256),
});

export const wechatAccountUpdateSchema = z.object({
  label: z.string().max(80).optional(),
  appId: z.string().min(6).max(128).optional(),
  appSecret: z.string().min(6).max(256).optional(),
  status: z.enum(["active", "invalid"]).optional(),
});

export const wechatTestSchema = z.object({
  id: z.string().min(1).optional(),
  appId: z.string().max(128).optional(),
  appSecret: z.string().max(256).optional(),
});

export const wechatTypesetSchema = z.object({
  markdown: z.string().min(1).max(100_000),
  theme: z.enum(["default", "grace", "simple"]).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontSize: z.string().max(20).optional(),
});

export const wechatJobCreateSchema = z.object({
  title: z.string().min(1).max(300),
  bodyHtml: z.string().min(1).max(500_000),
  accountId: z.string().min(1).nullable().optional(),
  summary: z.string().max(300).optional().default(""),
  author: z.string().max(80).optional().default(""),
  thumbUrl: z.string().max(2000).optional().default(""),
  channel: z.enum(["publish", "mass"]).optional().default("publish"),
  theme: z.string().max(40).optional().default("default"),
  publishTime: z.number().int().positive().nullable().optional(),
});

export const wechatJobUpdateSchema = z.object({
  title: z.string().max(300).optional(),
  summary: z.string().max(300).optional(),
  author: z.string().max(80).optional(),
  bodyHtml: z.string().max(500_000).optional(),
  thumbUrl: z.string().max(2000).optional(),
  channel: z.enum(["publish", "mass"]).optional(),
  theme: z.string().max(40).optional(),
  publishTime: z.number().int().positive().nullable().optional(),
  accountId: z.string().min(1).nullable().optional(),
  status: z.enum(["drafting", "drafted", "publishing", "published", "mass_sent", "failed", "cancelled"]).optional(),
  step: z.enum(["select", "typeset", "settings", "confirm", "done"]).optional(),
});

export const wechatJobSubmitSchema = z.object({
  accountId: z.string().min(1).nullable().optional(),
  title: z.string().min(1).max(300),
  summary: z.string().max(300).optional().default(""),
  author: z.string().max(80).optional().default(""),
  bodyHtml: z.string().min(1).max(500_000),
  thumbUrl: z.string().max(2000).optional().default(""),
  channel: z.enum(["publish", "mass"]),
  theme: z.string().max(40).optional().default("default"),
  publishTime: z.number().int().positive().nullable().optional(),
  publish: z.boolean().optional().default(true),
});
