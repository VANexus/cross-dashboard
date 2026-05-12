from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel


AgentStatus = Literal["online", "busy", "error", "offline"]
AgentType = Literal["sentinel", "dispatch", "operations", "risk_control", "legal", "marketing"]
TaskStatus = Literal["pending", "running", "completed", "failed", "cancelled"]
RiskLevel = Literal["safe", "level3", "level2", "level1"]
MemoryZone = Literal["preset", "dev", "prompt"]
EvolutionStage = Literal["identify", "generate", "test", "review", "reuse"]
EvolutionStatus = Literal["in_progress", "success", "failed"]
Priority = Literal["low", "medium", "high", "critical"]


class SubAgent(BaseModel):
    id: str
    parentId: str
    name: str
    status: AgentStatus
    spawnedAt: str
    taskDescription: str


class TaskStep(BaseModel):
    id: str
    name: str
    status: TaskStatus
    agentId: str
    startedAt: Optional[str] = None
    completedAt: Optional[str] = None
    output: Optional[str] = None


class Task(BaseModel):
    id: str
    title: str
    description: str
    status: TaskStatus
    priority: Priority
    assignedAgents: list[str]
    createdAt: str
    updatedAt: str
    completedAt: Optional[str] = None
    steps: list[TaskStep] = []
    output: Optional[str] = None


class RiskEvent(BaseModel):
    id: str
    level: RiskLevel
    title: str
    description: str
    source: str
    timestamp: str
    resolved: bool
    resolvedAt: Optional[str] = None
    actions: list[str]


class MemoryEntry(BaseModel):
    id: str
    zone: MemoryZone
    title: str
    content: str
    type: Literal["script", "code", "prompt", "skill"]
    version: int
    createdAt: str
    updatedAt: str
    verified: bool
    tags: list[str]


class EvolutionMetrics(BaseModel):
    accuracy: float
    latency: float
    coverage: float


class EvolutionRecord(BaseModel):
    id: str
    stage: EvolutionStage
    title: str
    description: str
    agentId: str
    startedAt: str
    completedAt: Optional[str] = None
    status: EvolutionStatus
    metrics: Optional[EvolutionMetrics] = None


class DashboardStats(BaseModel):
    totalAgents: int
    onlineAgents: int
    busyAgents: int
    errorAgents: int
    offlineAgents: int
    totalTasks: int
    runningTasks: int
    completedTasks: int
    failedTasks: int
    riskEvents24h: int
    activeCircuitBreakers: int


class CostBreakdown(BaseModel):
    category: str
    amount: float


class OperationsMetrics(BaseModel):
    productCount: int
    inventoryTurnover: float
    listingSuccessRate: float
    accountHealth: int


class MarketingMetrics(BaseModel):
    adSpend: int
    adRoi: float
    conversionRate: float
    csResponseTime: float


class FinanceMetrics(BaseModel):
    revenue: int
    profit: int
    cashflow: float
    costBreakdown: list[CostBreakdown]


class LegalMetrics(BaseModel):
    patentsMonitored: int
    activeContracts: int
    openDisputes: int
    complianceScore: int


class BusinessMetrics(BaseModel):
    operations: OperationsMetrics
    marketing: MarketingMetrics
    finance: FinanceMetrics
    legal: LegalMetrics


class WorkflowStatus(BaseModel):
    id: str
    name: str
    href: str
    status: Literal["running", "idle", "warning"]
    lastRun: str
    runs: int
    success: int


class Alert(BaseModel):
    id: str
    level: Literal["danger", "warning", "info"]
    message: str
    time: str
    href: str


class HealthDimension(BaseModel):
    label: str
    score: int
    value: str
    threshold: str
    status: Literal["pass", "warning"]


class RiskIndicator(BaseModel):
    name: str
    current: str
    threshold: str
    status: Literal["safe", "warning", "danger"]
    trend: list[float]


class DataSource(BaseModel):
    id: str
    name: str
    enabled: bool
    status: Literal["completed", "scraping", "pending"]
    progress: int


class ProductKeyword(BaseModel):
    keyword: str
    volume: int
    cpc: float
    competition: float
    supplyDemand: float
    trend: list[int]
    aiTag: Literal["potential", "competitive", "risky"]


class PainPoint(BaseModel):
    category: str
    count: int
    pct: int
    examples: list[str]


class GeneratedImg(BaseModel):
    id: str
    type: str
    clipScore: int
    ctrScore: int
    overall: int
    isBest: bool
    prompt: str
    model: str
    seed: int


class StoryboardFrame(BaseModel):
    id: str
    desc: str
    duration: str
    script: str
    camera: str
    source: str


class AdKeyword(BaseModel):
    id: str
    keyword: str
    impressions: int
    clicks: int
    spend: float
    sales: float
    acos: float
    conversion: float
    cpc: float
    tag: Literal["high-acos", "high-conversion", "non-precise"]
    type: Literal["SP", "SB", "SD"]
    trend: list[int]


class InfringementWord(BaseModel):
    word: str
    type: Literal["brand", "sensitive"]
    position: str


class CategoryRec(BaseModel):
    path: str
    confidence: int
    reason: str


class BulletPoint(BaseModel):
    title: str
    desc: str
    seoScore: int
    rufus: Literal["friendly", "neutral", "needs-opt"]


class InventoryItem(BaseModel):
    id: str
    sku: str
    name: str
    stock: int
    dailySales: int
    ratioDays: int
    stockoutDate: str
    restockQty: int
    restockDate: str
    status: Literal["normal", "warning", "caution", "stale", "overstock"]
    trend: list[int]
    avgCost: float
    shipDays: int


class KeywordItem(BaseModel):
    keyword: str
    volume: int
    competition: int
    type: Literal["core", "longtail", "competitor"]


class CompetitorEntry(BaseModel):
    name: str
    sp: int
    sb: int
    sd: int
    coreKeywords: int
    topPosition: int
    targeting: Literal["complement", "defense", "offense"]


class AdPosition(BaseModel):
    position: str
    percentage: int
    count: int


class RestockSuggestion(BaseModel):
    sku: str
    name: str
    currentStock: int
    dailySales: int
    suggestedQty: int
    urgency: Literal["high", "medium", "low"]
    shipMethod: str
    estimatedArrival: str


class Pagination(BaseModel):
    page: int
    pageSize: int
    total: int
    totalPages: int


class ApiResponse(BaseModel):
    success: bool = True
    data: Any
    pagination: Optional[Pagination] = None
    message: Optional[str] = None


class ApiError(BaseModel):
    success: bool = False
    error: str
    code: int
    details: Optional[dict[str, Any]] = None


class MemoryUsageStats(BaseModel):
    memoryId: str
    count: int
    trend: list[int]
    created: str
    modified: str
    workflows: list[str]


class CreateTaskRequest(BaseModel):
    title: str
    description: str
    priority: Priority
    assignedAgents: list[str]


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[Priority] = None


class UpdateStepRequest(BaseModel):
    status: Optional[TaskStatus] = None
    output: Optional[str] = None


class CreateRiskEventRequest(BaseModel):
    level: RiskLevel
    title: str
    description: str
    source: str
    actions: list[str]


class UpdateRiskEventRequest(BaseModel):
    resolved: Optional[bool] = None
    resolvedAt: Optional[str] = None


class CreateMemoryRequest(BaseModel):
    zone: MemoryZone
    title: str
    content: str
    type: Literal["script", "code", "prompt", "skill"]
    tags: list[str]


class UpdateMemoryRequest(BaseModel):
    zone: Optional[MemoryZone] = None
    title: Optional[str] = None
    content: Optional[str] = None
    type: Optional[Literal["script", "code", "prompt", "skill"]] = None
    tags: Optional[list[str]] = None


class CreateEvolutionRequest(BaseModel):
    stage: EvolutionStage
    title: str
    description: str
    agentId: str


class UpdateEvolutionRequest(BaseModel):
    status: Optional[EvolutionStatus] = None
    completedAt: Optional[str] = None
    metrics: Optional[EvolutionMetrics] = None


class UpdateIsolationRequest(BaseModel):
    index: int
    checked: bool


class UpdateImageRequest(BaseModel):
    clipScore: Optional[int] = None
    ctrScore: Optional[int] = None
    overall: Optional[int] = None
    isBest: Optional[bool] = None
    prompt: Optional[str] = None


class UpdateAdKeywordRequest(BaseModel):
    impressions: Optional[int] = None
    clicks: Optional[int] = None
    spend: Optional[float] = None
    sales: Optional[float] = None
    acos: Optional[float] = None
    conversion: Optional[float] = None
    cpc: Optional[float] = None
    tag: Optional[str] = None


class RestockOrderRequest(BaseModel):
    sku: str
    quantity: int
    shipMethod: str
