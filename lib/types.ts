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
