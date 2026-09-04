export type AgentStatus = "online" | "busy" | "error" | "offline";
// AgentType 已放开：不再固定 6 个枚举。任何 slug 都合法（如 "logistics"），
// 由「一句话动态生成」产出；sentinel/dispatch/... 仅是预设模板的 type。
export type AgentType = string;
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type RiskLevel = "safe" | "level3" | "level2" | "level1";
export type MemoryZone = "preset" | "dev" | "prompt" | "agent";

// ========== Agent Life System Types ==========

export type MoodState = "focused" | "alert" | "tired" | "stressed" | "curious" | "satisfied";

export interface AgentPersona {
  systemPrompt: string;
  communicationStyle: string;
  expertise: string[];
}

export interface AgentGoal {
  id: string;
  text: string;
  progress: number;
  priority: "high" | "medium" | "low";
}

export interface AgentMood {
  state: MoodState;
  energy: number;
  lastUpdated: string;
}

export interface AgentCycleConfig {
  intervalMs: number;
  enabled: boolean;
}

export interface AgentConfig {
  persona: AgentPersona;
  goals: AgentGoal[];
  mood: AgentMood;
  cycleConfig: AgentCycleConfig;
}

export interface JournalEntry {
  id: string;
  agentId: string;
  type: "thought" | "decision" | "observation" | "reflection";
  content: string;
  context: Record<string, unknown>;
  moodAt: string;
  createdAt: string;
}

export interface AgentEvent {
  type: "thought" | "decision" | "observation" | "reflection" | "mood_change" | "memory_created";
  agentId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  description: string;
  uptime: number;
  taskCount: number;
  successRate: number;
  lastHeartbeat: string;
  reflexLevel: number;
  config?: AgentConfig;
  /** 创建来源：preset（预设模板实例化）/ generated（一句话动态生成） */
  source?: "preset" | "generated";
}

/** 预设模板：一句话动态生成的参考底座（现有 6 个人格固化为模板） */
export interface AgentTemplate {
  id: string;
  type: string;
  name: string;
  description: string;
  config: AgentConfig;
  sort: number;
}

export interface TeamMember {
  agentId: string;
  role?: string;
  joinedAt: string;
}

export interface Team {
  id: string;
  name: string;
  goal: string;
  leaderAgentId?: string | null;
  createdAt: string;
  members: TeamMember[];
}

export interface SubAgent {
  id: string;
  parentId: string;
  name: string;
  status: AgentStatus;
  spawnedAt: string;
  taskDescription: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high" | "critical";
  assignedAgents: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  steps: TaskStep[];
  output?: string;
}

export interface TaskStep {
  id: string;
  name: string;
  status: TaskStatus;
  agentId: string;
  startedAt?: string;
  completedAt?: string;
  output?: string;
}

export interface RiskEvent {
  id: string;
  level: RiskLevel;
  title: string;
  description: string;
  source: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  actions: string[];
}

export interface MemoryEntry {
  id: string;
  zone: MemoryZone;
  title: string;
  content: string;
  type: "script" | "code" | "prompt" | "skill" | "insight";
  version: number;
  createdAt: string;
  updatedAt: string;
  verified: boolean;
  tags: string[];
  /** 归属 Agent（记忆系统的 agent 侧隔离） */
  agentId?: string | null;
}

export interface EvolutionRecord {
  id: string;
  stage: "identify" | "generate" | "test" | "review" | "reuse";
  title: string;
  description: string;
  agentId: string;
  startedAt: string;
  completedAt?: string;
  status: "in_progress" | "success" | "failed";
  source?: "manual" | "auto";
  metrics?: {
    accuracy: number;
    latency: number;
    coverage: number;
  };
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  responseTime: number;
  throughput: number;
  activeConnections: number;
  taskQueueLength: number;
  errorRate: number;
}

export interface DashboardStats {
  totalAgents: number;
  onlineAgents: number;
  busyAgents: number;
  errorAgents: number;
  offlineAgents: number;
  totalTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  riskEvents24h: number;
  activeCircuitBreakers: number;
}

export interface BusinessMetrics {
  operations: {
    productCount: number;
    inventoryTurnover: number;
    listingSuccessRate: number;
    accountHealth: number;
  };
  marketing: {
    adSpend: number;
    adRoi: number;
    conversionRate: number;
    csResponseTime: number;
  };
  finance: {
    revenue: number;
    profit: number;
    cashflow: number;
    costBreakdown: { category: string; amount: number }[];
  };
  legal: {
    patentsMonitored: number;
    activeContracts: number;
    openDisputes: number;
    complianceScore: number;
  };
}

export interface GeneratedImg {
  id: string;
  type: string;
  url?: string;
  clipScore: number;
  ctrScore: number;
  overall: number;
  isBest: boolean;
  prompt: string;
  model: string;
  seed: number;
  revisedPrompt?: string;
}

export interface AdKeyword {
  id: string;
  keyword: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  acos: number;
  conversion: number;
  cpc: number;
  tag: "high-acos" | "high-conversion" | "non-precise";
  type: "SP" | "SB" | "SD";
  trend: number[];
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  stock: number;
  dailySales: number;
  ratioDays: number;
  stockoutDate: string;
  restockQty: number;
  restockDate: string;
  status: "normal" | "warning" | "caution" | "stale" | "overstock";
  trend: number[];
  avgCost: number;
  shipDays: number;
}

export interface KeywordItem {
  keyword: string;
  volume: number;
  competition: number;
  cpc: number;
  trend: number[];
  type: "core" | "longtail" | "competitor";
}

export interface CompetitorEntry {
  id: string;
  name: string;
  spCount: number;
  sbCount: number;
  sdCount: number;
  keywords: number;
  rank: number;
  strategy: "offensive" | "complementary" | "defensive";
}

export interface WorkflowStatus {
  id: string;
  name: string;
  href: string;
  status: "running" | "idle" | "warning";
  lastRun: string;
  runs: number;
  success: number;
}

export interface Alert {
  id: string;
  level: "danger" | "warning" | "info";
  message: string;
  time: string;
  href: string;
}

export interface HealthDimension {
  label: string;
  score: number;
  value: string;
  threshold: string;
  status: "pass" | "warning";
}

export interface RiskIndicator {
  name: string;
  current: string;
  threshold: string;
  status: "safe" | "warning" | "danger";
  trend: number[];
}

export interface MemoryUsageStats {
  memoryId: string;
  count: number;
  trend: number[];
  created: string;
  modified: string;
  workflows: string[];
}

export interface BeforeMetrics {
  accuracy: number;
  latency: number;
  coverage: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: Pagination;
}

export interface ApiError {
  success: false;
  error: string;
  code: number;
  details?: Record<string, unknown>;
}

export interface DataSource {
  id: string;
  name: string;
  enabled: boolean;
  status: "completed" | "scraping" | "pending";
  progress: number;
}

export interface ProductKeyword {
  keyword: string;
  volume: number;
  cpc: number;
  competition: number;
  supplyDemand: number;
  trend: number[];
  aiTag: "potential" | "competitive" | "risky";
}

export interface PainPoint {
  category: string;
  count: number;
  pct: number;
  examples: string[];
}

export interface StoryboardFrame {
  id: string;
  desc: string;
  duration: string;
  script: string;
  camera: string;
  source: string;
}

export interface InfringementWord {
  word: string;
  type: "brand" | "patent" | "generic";
  risk: string;
  action: string;
}

export interface CategoryRec {
  id: string;
  name: string;
  confidence: number;
  reason: string;
  bsr: number;
  fee: number;
}

export interface BulletPoint {
  id: string;
  title: string;
  content: string;
  seoScore: number;
  rufus: boolean;
}

export interface AdPosition {
  position: string;
  share: number;
  trend: number[];
}

export interface RestockSuggestion {
  id: string;
  sku: string;
  name: string;
  suggestedQty: number;
  urgency: "high" | "medium" | "low";
  method: string;
  eta: string;
  cost: number;
}

// ========== 视频本地化（video-localizer 后端） ==========

export type LocalizeTaskStatus =
  | "queued"
  | "running"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled"
  | "not_found"
  | "unknown";

export interface LocalizeTask {
  id: string;
  batchId: string;
  videoPath: string;
  targetLang: string;
  sourceLang: string;
  enableTts: boolean;
  removeSubtitles: boolean;
  status: LocalizeTaskStatus;
  outputs: Record<string, string>;
  error: string | null;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationSeconds: number | null;
  isTerminal: boolean;
  isStalled: boolean;
  updatedAt: string;
}

export interface LocalizeBatch {
  id: string;
  jobIds: string[];
  videoCount: number;
  targetLang: string;
  sourceLang: string;
  enableTts: boolean;
  removeSubtitles: boolean;
  costBand: "低" | "中" | "高";
  submittedAt: string;
}

export interface LocalizeHealth {
  ok: boolean;
  latencyMs: number;
  apiBase: string;
  error?: string;
}

export interface LocalizeBatchReport {
  batchId: string;
  batchIds: string[];
  jobIds: string[];
  submittedCount: number;
  rejectedCount: number;
  rejectedPaths: string[];
  costBand: "低" | "中" | "高";
  ttsRecommended: boolean;
  batchSizeWarning: boolean;
  apiMessage: string;
  failureCategory?: string;
  retriable?: boolean;
  warning?: string;
}

// ── 内容创作中心（Content Studio）──
export type ContentPlatform = "xhs" | "wechat" | "douyin";

export interface IdeaAngle {
  angle: string;
  title: string;
  reason?: string;
}

export interface ContentIdea {
  id: string;
  platform: ContentPlatform;
  angle: string;
  title: string;
  subject: string;
  createdAt: string;
}

export interface HotTopic {
  word: string;
  heat: number;
  delta: number | null;
  url: string;
  source: string;
}

export interface HotTopicsResult {
  platform: ContentPlatform;
  source: string;
  endpoint: string;
  degraded: boolean;
  degradationReason?: string;
  topics: HotTopic[];
  failureCategory?: string;
  retriable?: boolean;
  warning?: string;
}

export interface AuditFinding {
  category: string;
  severity: "error" | "warning";
  message: string;
  suggestion: string;
  matchedText?: string;
  ruleId?: string;
}

export interface AuditResult {
  platform: ContentPlatform;
  passed: boolean;
  findings: AuditFinding[];
  llmReviewed: boolean;
  ruleFindingCount: number;
  llmFindingCount: number;
}

export interface ContentImage {
  index: number;
  url: string;
}

export interface ContentImageResult {
  platform: ContentPlatform;
  width: number;
  height: number;
  backendUsed: string;
  images: ContentImage[];
}

export type ContentDraftStatus = "draft" | "published" | "archived";

export interface CopyDraft {
  id: string;
  platform: ContentPlatform;
  title: string;
  body: string;
  tags: string[];
  status: ContentDraftStatus;
  auditPassed: boolean;
  auditResult: AuditFinding[] | null;
  imageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContentWorks {
  drafts: CopyDraft[];
  videos: LocalizeTask[];
}

export interface ContentPlatformMeta {
  id: ContentPlatform;
  label: string;
  color: string;
  hint: string;
  imageAspect: string;
}

// ── B端运营工作台（B2B Operations Workbench）──

export type B2BPreference = "social" | "alibaba" | "mix";
export type TrendPlatform = "tiktok" | "instagram" | "alibaba";

export interface KeywordTrend {
  word: string;
  heat: number;
  delta: number | null;
  rank: number;
  industry: string;
  source: string;
}

export interface KeywordTrendsResult {
  platform: TrendPlatform;
  source: string;
  degraded: boolean;
  keywords: KeywordTrend[];
  failureCategory?: string;
  retriable?: boolean;
  warning?: string;
  /** 最近一次真实抓取时间（ISO）；GET 秒回/缓存路径由 DB fetched_at 推出 */
  fetchedAt?: string;
  /** TikHub 缓存元信息（flowmind _tikhub_cache 透传）：local=本地命中 speculative=免费窗投机 live=真实外呼 */
  cache?: { mode: string; hit: boolean; ageS?: number };
  /** true 表示本次响应来自 DB 秒回，且已触发后台保鲜（稍后自动变新） */
  refreshing?: boolean;
}

export interface LongtailKeyword {
  word: string;
  category: string;
  searchIntent: string;
}

export interface AlibabaProduct {
  productId: string;
  subject: string;
  keywords: string[];
  imageUrl: string;
  price: string;
  status: string;
}

export interface AlibabaProductsEnvelope {
  products: AlibabaProduct[];
  authorized: boolean;
  degraded?: boolean;
  warning?: string;
  failureCategory?: string;
  retriable?: boolean;
  /** 商品池最近一次真实拉取时间（ISO） */
  fetchedAt?: string;
  /** true 表示本次响应来自 DB 秒回，且已触发后台保鲜 */
  refreshing?: boolean;
}

export interface ListingRecommendation {
  productId: string;
  subject: string;
  score: number;
  reasons: string[];
}

export type ListingUploadStatus = "draft" | "uploading" | "uploaded" | "failed";

export interface B2BListingDraft {
  id: string;
  productId: string;
  preference: B2BPreference;
  title: string;
  description: string;
  keywords: string[];
  imageUrl: string;
  imagePrompt: string;
  uploadStatus: ListingUploadStatus;
  uploadedProductId: string;
  createdAt: string;
  warnings?: string[];
}

export interface ListingPublishResult {
  productId: string;
  strProductId: string;
  posted: boolean;
  warnings?: string[];
  error?: string;
}

export interface ImageSkill {
  id: string;
  name: string;
  coverUrl: string;
  reversedPrompt: string;
  styleTags: string[];
  aspectRatio: string;
  platform: string;
  templateType: "" | "主图" | "详情页" | "社媒" | "其他";
  isBuiltin: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReversePromptResult {
  prompt: string;
  styleTags: string[];
  negativePrompt: string;
}

export type B2BSettingsGroup =
  | "channel"
  | "alibaba"
  | "webhook"
  | "mcp";

export interface B2BSettings {
  /**
   * 服务化改造（2026-09-03）：以下配置不再由用户显式填写——
   *   flowmindMcpUrl → 集群服务目录（lib/cluster，flowmind-mcp 服务发现）
   *   longcatApiKey / allinApiKey → LiteLLM 网关 + flowmind-mcp Secret（不落库、不进 UI）
   *   browserDebugUrl → 开发机 .env BROWSER_DEBUG_URL（本机调试路径，集群不可达无意义）
   * 此处只保留「业务凭证/登录态」：属于用户数据，不是基础设施配置。
   */
  /** 平台登录会话（兜底路径），格式 "k=v; k2=v2" */
  tiktokSessionCookie: string;
  instagramSessionCookie: string;
  alibabaAppKey: string;
  alibabaAppSecret: string;
  alibabaSession: string;
  feishuWebhookUrl: string;
  wecomWebhookUrl: string;
  /** 每日推送开关："true" / "false"（KV 字符串存储） */
  b2bPushFeishuEnabled: string;
  b2bPushWecomEnabled: string;
  /** 每日刷新回调地址（如 https://flowmind.xrak.top/api/b2b/daily-refresh） */
  b2bDailyRefreshUrl: string;
  /** daily-refresh 路由鉴权 token（x-refresh-token 请求头） */
  b2bDailyRefreshToken: string;
}

export interface B2BHealthStatus {
  database: { ok: boolean; latencyMs: number; rowsInImageSkills?: number; error?: string };
  groups: Record<B2BSettingsGroup, { ok: boolean; error?: string; latencyMs?: number; reachable?: boolean }>;
}

/** 渠道账号保险库（browser_worker_saas_design.md M2） */
export type ChannelPlatform = "tiktok" | "instagram" | "alibaba";
export type ChannelAccountStatus = "active" | "expired" | "risk_control";

export interface ChannelAccount {
  id: string;
  platform: ChannelPlatform;
  label: string;
  /** 会话密文（AES-256-GCM），仅服务端可见；列表返回空串 */
  sessionEnc: string;
  status: ChannelAccountStatus;
  lastCheckedAt: string | null;
  createdAt: string;
}


export interface B2BTestResult {
  group: B2BSettingsGroup;
  ok: boolean;
  error?: string;
  latencyMs?: number;
  reachable?: boolean;
}

export interface DailyDigestResult {
  date: string;
  sections: Array<{
    platform: string;
    label: string;
    source: string;
    degraded: boolean;
    failureCategory?: string;
    keywords: Array<{ word: string; heat: number; rank: number }>;
  }>;
  longtailWords: string[];
  longtailError?: string;
  markdown: string;
  pushes: Array<{ channel: string; ok: boolean; latencyMs: number; error?: string }>;
}

export interface PushTestResult {
  channel: "feishu" | "wecom";
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface DailyRefreshResult {
  date: string;
  idempotent?: boolean;
  message?: string;
  platforms?: Record<string, { degraded: boolean; count: number; warning?: string }>;
  digest?: DailyDigestResult | null;
  digestError?: string;
}

// ── TikHub 情报中心（广告 / 选品 / 内容达人，全部真实数据）──

/** 三 skill 共用的降级信封 */
export interface IntelEnvelope {
  source: string;
  degraded: boolean;
  failureCategory?: string | null;
  retriable?: boolean;
  warning?: string | null;
}

/** 竞品广告创意（tiktok_ad_intel.search_ads） */
export interface AdMaterial {
  id: string;
  rank: number;
  title: string;
  brand: string;
  ctr: number | null;
  likes: number | null;
  cost: number | null;
  objective: string;
  industryKey: string;
  isSearch: boolean;
  durationS: number | null;
  coverUrl: string;
  videoUrl: string;
  width: number | null;
  height: number | null;
}

export interface AdIntelResult extends IntelEnvelope {
  action: string;
  materials: AdMaterial[];
  pagination: { hasMore?: boolean; page?: number; total?: number; size?: number };
  filters: Record<string, Array<{ id: string; label: string; parentId?: number | null }>>;
  locations: Array<{ id: string; name: string }>;
  hashtagDetail: HashtagDetail;
}

export interface HashtagDetail {
  hashtagId?: string;
  name?: string;
  vv?: number | null;
  publishCnt?: number | null;
  timeRange?: number | null;
  curve?: Array<{ timestamp: string; value: number }>;
  ageProfile?: Array<{ level: string; percent: number | null }>;
  countryProfile?: Array<{ country: string; tgi: number | null }>;
  videos?: Array<{ itemId: string; coverUrl: string; videoUrl: string }>;
  [k: string]: unknown;
}

/** TikTok Shop 选品（tiktok_shop_intel） */
export interface ShopProduct {
  productId: string;
  title: string;
  imageUrl: string;
  price: string;
  originalPrice: string;
  discount: string;
  currency: string;
  rating: number | null;
  reviewCount: number | null;
  soldCount: number | null;
  sellerId: string;
  sellerName: string;
  brand: string;
  url: string;
  labels: string[];
}

export interface ShopReview {
  reviewId: string;
  rating: number | null;
  time: string;
  verified: boolean;
  incentivized: boolean;
  reviewer: string;
  text: string;
  images: string[];
  skuSpec: string;
  country: string;
}

export interface ShopCategoryNode {
  categoryId: string;
  name: string;
  level: number | null;
  isLeaf: boolean;
  children: ShopCategoryNode[];
}

export interface ShopIntelResult extends IntelEnvelope {
  action: string;
  products: ShopProduct[];
  page: { hasMore?: boolean; offset?: number; pageToken?: string; size?: number };
  suggestions: string[];
  categories: ShopCategoryNode[];
  detail: ShopProductDetail;
  reviews: ShopReview[];
  reviewSummary: {
    total?: string; avg?: number | null; hasMore?: boolean;
    distribution?: Record<string, string>;
  };
}

export interface ShopProductDetail {
  productId?: string;
  sellerId?: string;
  name?: string;
  soldCount?: number | null;
  images?: string[];
  descImages?: string[];
  specs?: Array<{ name: string; values: string[] }>;
  variants?: Array<{ name: string; values: string[] }>;
  skuCount?: number;
  videoUrls?: string[];
  shop?: {
    sellerId: string; shopName: string; shopRating: number | null;
    reviewCount: number | null; followers: number | null; shopSold: number | null; onSellCount: number | null;
  };
  [k: string]: unknown;
}

/** 内容 / 达人 / 音乐（tiktok_content_intel） */
export interface VideoItem {
  awemeId: string;
  desc: string;
  createTime: number | null;
  durationS: number | null;
  play: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  collects: number | null;
  authorId: string;
  author: string;
  authorHandle: string;
  authorFollowers: number | null;
  coverUrl: string;
  videoUrl: string;
  musicTitle: string;
}

export interface MusicItem {
  rank: number;
  musicId: string;
  title: string;
  author: string;
  durationS: number | null;
  userCount: number | null;
  trend: number | null;
  coverUrl: string;
  artists: string[];
}

export interface CreatorInsight {
  queryId: string;
  query: string;
  popularity: number | null;
  popularityV2: number | null;
  videoNum: number | null;
  trendSeq: number[];
  categoryL1: string;
  categoryL2: string;
  businessTypes: string[];
}

export interface IgPost {
  mediaId: string;
  code: string;
  caption: string;
  hashtags: string[];
  likes: number | null;
  comments: number | null;
  plays: number | null;
  isVideo: boolean;
  mediaType: number | null;
  thumbnail: string;
  videoUrl: string;
  takenAt: number | null;
  username: string;
  userFullname: string;
  verified: boolean;
}

export interface CreatorProfile {
  userId?: string;
  secUserId?: string;
  uniqueId?: string;
  nickname?: string;
  followers?: number | null;
  following?: number | null;
  awemeCount?: number | null;
  signature?: string;
  customVerify?: string;
  isStar?: boolean;
  avatarUrl?: string;
  country?: string;
  [k: string]: unknown;
}

export interface ContentIntelResult extends IntelEnvelope {
  action: string;
  trendingWords: Array<{ word: string; type: string }>;
  videos: VideoItem[];
  music: MusicItem[];
  insights: CreatorInsight[];
  profile: CreatorProfile;
  igPosts: IgPost[];
  igPaginationToken: string;
}

/** 趋势时序快照（P1，每日落库） */
export interface TrendSnapshot {
  id: string;
  platform: TrendPlatform;
  word: string;
  heat: number;
  delta: number | null;
  rank: number;
  industry: string;
  source: string;
  snapshotDate: string;
}

export interface TrendRising {
  word: string;
  heat: number;
  delta: number | null;
  deltaPct: number | null;
  rank: number;
  spark: number[];
  industry: string;
}


// ── 微信公众号端到端发布（M3：文案 → 排版 → 发布/群发）──

export type WechatChannel = "publish" | "mass";
export type WechatAccountStatus = "active" | "invalid";
export type WechatPublishStatus =
  | "drafting" | "drafted" | "publishing" | "published"
  | "mass_sent" | "failed" | "cancelled";
export type WechatPublishStep = "select" | "typeset" | "settings" | "confirm" | "done";

/** 前端展示用公众号账号（明文凭证只在创建/测试时进出，绝不随列表返回） */
export interface WechatAccount {
  id: string;
  label: string;
  appIdMasked: string;
  isDefault: boolean;
  status: WechatAccountStatus;
  lastCheckedAt: string | null;
  createdAt: string;
}

/** 测试连接返回 */
export interface WechatAccountTestResult {
  ok: boolean;
  appIdMasked: string;
  nickname?: string | null;
  warning?: string | null;
  failureCategory?: string | null;
}

/** 排版主题元数据 */
export interface WechatTypesetTheme {
  id: string;
  label: string;
  primary: string;
}

/** 排版结果 */
export interface WechatTypesetResult {
  html: string;
  theme: string;
  themeLabel: string;
  stats: Record<string, number>;
}

/** 发布任务（wf_wechat_publish_jobs） */
export interface WechatPublishJob {
  id: string;
  accountId: string | null;
  title: string;
  summary: string;
  author: string;
  bodyHtml: string;
  thumbUrl: string;
  channel: WechatChannel;
  theme: string;
  publishTime: number | null;
  status: WechatPublishStatus;
  step: WechatPublishStep;
  mediaId: string;
  publishId: string | null;
  msgId: string | null;
  articleUrl: string | null;
  warning: string;
  steps: string[];
  createdAt: string;
  updatedAt: string;
}

/** 发布提交返回 */
export interface WechatPublishSubmitResult {
  status: string;
  mediaId: string;
  publishId: string | null;
  msgId: string | null;
  bodyImages: Array<{ src: string; url: string; ok: boolean; error?: string }>;
  warning?: string;
}
