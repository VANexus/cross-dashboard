export type AgentStatus = "online" | "busy" | "error" | "offline";
export type AgentType = "sentinel" | "dispatch" | "operations" | "risk_control" | "legal" | "marketing";
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type RiskLevel = "safe" | "level3" | "level2" | "level1";
export type MemoryZone = "preset" | "dev" | "prompt";

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
  type: "script" | "code" | "prompt" | "skill";
  version: number;
  createdAt: string;
  updatedAt: string;
  verified: boolean;
  tags: string[];
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
  | "longcat"
  | "allin"
  | "webhook"
  | "mcp";

export interface B2BSettings {
  flowmindMcpUrl: string;
  /** 平台登录会话（站内渠道授权登录捕获），格式 "k=v; k2=v2" */
  tiktokSessionCookie: string;
  instagramSessionCookie: string;
  alibabaAppKey: string;
  alibabaAppSecret: string;
  alibabaSession: string;
  longcatApiKey: string;
  allinApiKey: string;
  feishuWebhookUrl: string;
  wecomWebhookUrl: string;
  /** 每日推送开关："true" / "false"（KV 字符串存储） */
  b2bPushFeishuEnabled: string;
  b2bPushWecomEnabled: string;
  /** pg_cron 回调地址（如 https://your-domain/api/b2b/daily-refresh） */
  b2bDailyRefreshUrl: string;
  /** daily-refresh 路由鉴权 token（x-refresh-token 请求头） */
  b2bDailyRefreshToken: string;
}

export interface B2BHealthStatus {
  supabase: { ok: boolean; latencyMs: number; rowsInImageSkills?: number; error?: string };
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
