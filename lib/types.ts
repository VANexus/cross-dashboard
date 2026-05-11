export type AgentStatus = "online" | "busy" | "error" | "offline";
export type AgentType = "sentinel" | "dispatch" | "operations" | "risk_control" | "legal" | "marketing";
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type RiskLevel = "safe" | "level3" | "level2" | "level1";
export type MemoryZone = "preset" | "dev" | "prompt";

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
  clipScore: number;
  ctrScore: number;
  overall: number;
  isBest: boolean;
  prompt: string;
  model: string;
  seed: number;
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
  type: "core" | "longtail" | "competitor";
}

export interface CompetitorEntry {
  name: string;
  sp: number;
  sb: number;
  sd: number;
  coreKeywords: number;
  topPosition: number;
  targeting: "complement" | "defense" | "offense";
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
  type: "brand" | "sensitive";
  position: string;
}

export interface CategoryRec {
  path: string;
  confidence: number;
  reason: string;
}

export interface BulletPoint {
  title: string;
  desc: string;
  seoScore: number;
  rufus: "friendly" | "neutral" | "needs-opt";
}

export interface AdPosition {
  position: string;
  percentage: number;
  count: number;
}

export interface RestockSuggestion {
  sku: string;
  name: string;
  currentStock: number;
  dailySales: number;
  suggestedQty: number;
  urgency: "high" | "medium" | "low";
  shipMethod: string;
  estimatedArrival: string;
}
