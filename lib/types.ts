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
