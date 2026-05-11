import {
  agents,
  tasks,
  riskEvents,
  memoryEntries,
  evolutionRecords,
  systemMetrics,
  dashboardStats,
  businessMetrics,
  revenueData,
  taskTrendData,
  subAgents,
} from "./mock-data";
import type {
  Agent,
  Task,
  TaskStep,
  RiskEvent,
  MemoryEntry,
  EvolutionRecord,
  SubAgent,
} from "./types";

const store = {
  agents: [...agents] as Agent[],
  subAgents: [...subAgents] as SubAgent[],
  tasks: [...tasks] as Task[],
  riskEvents: [...riskEvents] as RiskEvent[],
  memoryEntries: [...memoryEntries] as MemoryEntry[],
  evolutionRecords: [...evolutionRecords] as EvolutionRecord[],
  systemMetrics: { ...systemMetrics },
  dashboardStats: { ...dashboardStats },
  businessMetrics: { ...businessMetrics },
  revenueData: [...revenueData],
  taskTrendData: [...taskTrendData],
};

export function getAgents(filters?: { status?: string; type?: string }) {
  let result = store.agents;
  if (filters?.status) result = result.filter((a) => a.status === filters.status);
  if (filters?.type) result = result.filter((a) => a.type === filters.type);
  return result;
}

export function getAgentById(id: string) {
  const agent = store.agents.find((a) => a.id === id);
  if (!agent) return null;
  const subs = store.subAgents.filter((s) => s.parentId === id);
  return { ...agent, subAgents: subs };
}

export function getTasks(filters?: {
  status?: string;
  priority?: string;
  page?: number;
  pageSize?: number;
}) {
  let result = store.tasks;
  if (filters?.status) result = result.filter((t) => t.status === filters.status);
  if (filters?.priority) result = result.filter((t) => t.priority === filters.priority);

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const total = result.length;
  const start = (page - 1) * pageSize;
  const items = result.slice(start, start + pageSize);

  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export function getTaskById(id: string) {
  return store.tasks.find((t) => t.id === id) || null;
}

export function createTask(data: {
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  assignedAgents: string[];
}): Task {
  const task: Task = {
    id: `task-${Date.now()}`,
    title: data.title,
    description: data.description,
    status: "pending",
    priority: data.priority,
    assignedAgents: data.assignedAgents,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [],
  };
  store.tasks.unshift(task);
  return task;
}

export function updateTask(id: string, data: Partial<Task>) {
  const idx = store.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  store.tasks[idx] = { ...store.tasks[idx], ...data, updatedAt: new Date().toISOString() };
  return store.tasks[idx];
}

export function deleteTask(id: string) {
  const idx = store.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  store.tasks.splice(idx, 1);
  return true;
}

export function updateTaskStep(
  taskId: string,
  stepId: string,
  data: Partial<TaskStep>
) {
  const task = store.tasks.find((t) => t.id === taskId);
  if (!task) return null;
  const stepIdx = task.steps.findIndex((s) => s.id === stepId);
  if (stepIdx === -1) return null;
  task.steps[stepIdx] = { ...task.steps[stepIdx], ...data };
  return task.steps[stepIdx];
}

export function getRiskEvents(filters?: {
  level?: string;
  resolved?: string;
  page?: number;
  pageSize?: number;
}) {
  let result = store.riskEvents;
  if (filters?.level) result = result.filter((r) => r.level === filters.level);
  if (filters?.resolved !== undefined) {
    const isResolved = filters.resolved === "true";
    result = result.filter((r) => r.resolved === isResolved);
  }
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const total = result.length;
  const start = (page - 1) * pageSize;
  const items = result.slice(start, start + pageSize);

  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export function createRiskEvent(data: {
  level: string;
  title: string;
  description: string;
  source: string;
  actions: string[];
}): RiskEvent {
  const event: RiskEvent = {
    id: `risk-${Date.now()}`,
    level: data.level as RiskEvent["level"],
    title: data.title,
    description: data.description,
    source: data.source,
    timestamp: new Date().toISOString(),
    resolved: false,
    actions: data.actions,
  };
  store.riskEvents.unshift(event);
  return event;
}

export function updateRiskEvent(id: string, data: { resolved?: boolean; resolvedAt?: string }) {
  const idx = store.riskEvents.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  store.riskEvents[idx] = { ...store.riskEvents[idx], ...data };
  return store.riskEvents[idx];
}

const isolationItems = [
  { label: "邮箱隔离", desc: "每个店铺使用独立邮箱", checked: true },
  { label: "浏览器隔离", desc: "使用独立浏览器指纹", checked: true },
  { label: "信用卡隔离", desc: "每个店铺使用不同信用卡", checked: true },
  { label: "电话号码隔离", desc: "每个店铺使用不同电话", checked: false },
  { label: "文案风格差异化", desc: "不同店铺使用不同文案风格", checked: true },
  { label: "操作手法隔离", desc: "每次只进入一个店铺", checked: true },
];

export function getIsolationItems() {
  return [...isolationItems];
}

export function updateIsolationItem(index: number, checked: boolean) {
  if (index >= 0 && index < isolationItems.length) {
    isolationItems[index].checked = checked;
  }
  return [...isolationItems];
}

export function getMemoryEntries(filters?: {
  zone?: string;
  type?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  let result = store.memoryEntries;
  if (filters?.zone) result = result.filter((m) => m.zone === filters.zone);
  if (filters?.type) result = result.filter((m) => m.type === filters.type);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const total = result.length;
  const start = (page - 1) * pageSize;
  const items = result.slice(start, start + pageSize);

  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export function getMemoryById(id: string) {
  return store.memoryEntries.find((m) => m.id === id) || null;
}

export function createMemory(data: {
  zone: string;
  title: string;
  content: string;
  type: string;
  tags: string[];
}): MemoryEntry {
  const entry: MemoryEntry = {
    id: `mem-${Date.now()}`,
    zone: data.zone as MemoryEntry["zone"],
    title: data.title,
    content: data.content,
    type: data.type as MemoryEntry["type"],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    verified: false,
    tags: data.tags,
  };
  store.memoryEntries.unshift(entry);
  return entry;
}

export function updateMemory(id: string, data: Partial<MemoryEntry>) {
  const idx = store.memoryEntries.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  const existing = store.memoryEntries[idx];
  store.memoryEntries[idx] = {
    ...existing,
    ...data,
    version: data.content && data.content !== existing.content ? existing.version + 1 : existing.version,
    updatedAt: new Date().toISOString(),
  };
  return store.memoryEntries[idx];
}

export function deleteMemory(id: string) {
  const idx = store.memoryEntries.findIndex((m) => m.id === id);
  if (idx === -1) return false;
  store.memoryEntries.splice(idx, 1);
  return true;
}

export function getMemoryUsage(id: string) {
  const usageMap: Record<string, { count: number; trend: number[]; created: string; modified: string; workflows: string[] }> = {
    "1": { count: 47, trend: [12, 15, 18, 22, 28, 35, 47], created: "2026-03-12", modified: "2026-05-01", workflows: ["选品工作流"] },
    "2": { count: 156, trend: [45, 62, 78, 95, 110, 135, 156], created: "2026-02-08", modified: "2026-05-07", workflows: ["选品工作流", "竞品广告"] },
    "3": { count: 23, trend: [5, 8, 10, 14, 18, 20, 23], created: "2026-04-20", modified: "2026-04-29", workflows: ["AI 上架"] },
    "4": { count: 89, trend: [22, 35, 48, 56, 68, 79, 89], created: "2026-03-01", modified: "2026-05-06", workflows: ["AI 广告"] },
    "5": { count: 34, trend: [8, 12, 15, 20, 24, 29, 34], created: "2026-04-05", modified: "2026-05-02", workflows: ["AI 作图"] },
    "6": { count: 67, trend: [15, 22, 30, 40, 48, 58, 67], created: "2026-03-18", modified: "2026-05-04", workflows: ["库销比"] },
  };
  return usageMap[id] || { count: 0, trend: [0, 0, 0, 0, 0, 0, 0], created: "2026-01-01", modified: "2026-01-01", workflows: [] };
}

export function getEvolutionRecords(filters?: {
  stage?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  let result = store.evolutionRecords;
  if (filters?.stage) result = result.filter((r) => r.stage === filters.stage);
  if (filters?.status) result = result.filter((r) => r.status === filters.status);

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const total = result.length;
  const start = (page - 1) * pageSize;
  const items = result.slice(start, start + pageSize);

  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export function getEvolutionById(id: string) {
  const record = store.evolutionRecords.find((r) => r.id === id);
  if (!record) return null;
  const beforeMap: Record<string, { accuracy: number; latency: number; coverage: number }> = {
    "1": { accuracy: 72, latency: 450, coverage: 60 },
    "3": { accuracy: 58, latency: 380, coverage: 45 },
  };
  return { ...record, beforeMetrics: beforeMap[id] || null };
}

export function createEvolution(data: {
  stage: string;
  title: string;
  description: string;
  agentId: string;
}): EvolutionRecord {
  const record: EvolutionRecord = {
    id: `evo-${Date.now()}`,
    stage: data.stage as EvolutionRecord["stage"],
    title: data.title,
    description: data.description,
    agentId: data.agentId,
    startedAt: new Date().toISOString(),
    status: "in_progress",
  };
  store.evolutionRecords.unshift(record);
  return record;
}

export function updateEvolution(id: string, data: Partial<EvolutionRecord>) {
  const idx = store.evolutionRecords.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  store.evolutionRecords[idx] = { ...store.evolutionRecords[idx], ...data };
  return store.evolutionRecords[idx];
}

export function getEvolutionTrend(months = 6) {
  const labels = ["12月", "1月", "2月", "3月", "4月", "5月"];
  const data = [2, 3, 1, 4, 3, 5];
  return { labels: labels.slice(-months), data: data.slice(-months) };
}

export function getDashboardData() {
  const workflows = [
    { id: "product-research", name: "选品工作流", href: "/workflows/product-research", status: "idle" as const, lastRun: "2026-05-08T14:30:00Z", runs: 45, success: 92 },
    { id: "ai-imaging", name: "AI 作图", href: "/workflows/ai-imaging", status: "idle" as const, lastRun: "2026-05-08T16:00:00Z", runs: 120, success: 88 },
    { id: "ai-advertising", name: "AI 广告", href: "/workflows/ai-advertising", status: "running" as const, lastRun: "2026-05-09T02:00:00Z", runs: 230, success: 95 },
    { id: "ai-listing", name: "AI 上架", href: "/workflows/ai-listing", status: "idle" as const, lastRun: "2026-05-07T10:00:00Z", runs: 78, success: 96 },
    { id: "inventory", name: "库销比", href: "/workflows/inventory", status: "warning" as const, lastRun: "2026-05-09T01:00:00Z", runs: 56, success: 90 },
    { id: "competitor-ads", name: "竞品广告分析", href: "/workflows/competitor-ads", status: "idle" as const, lastRun: "2026-05-08T20:00:00Z", runs: 34, success: 87 },
  ];
  const alerts = [
    { id: "alert-1", level: "danger" as const, message: "账号 health-score 下降至 87 分，接近预警阈值", time: "5 分钟前", href: "/risk" },
    { id: "alert-2", level: "warning" as const, message: "SKU-E004 库销比达 90 天，建议启动清仓", time: "1 小时前", href: "/workflows/inventory" },
    { id: "alert-3", level: "warning" as const, message: "选品工作流 SIF 数据源连续 2 次超时", time: "2 小时前", href: "/workflows/product-research" },
    { id: "alert-4", level: "info" as const, message: "AI 广告完成 US-2026-147 轮询调整，ACOS 降至 22%", time: "3 小时前", href: "/workflows/ai-advertising" },
  ];
  const trends = {
    sales: [1200, 1350, 1280, 1420, 1580, 1650, 1720],
    acos: [28, 26, 25, 24, 22, 21, 20],
    conversion: [12, 13, 12.5, 14, 15, 14.5, 16],
  };
  return {
    stats: store.dashboardStats,
    businessMetrics: store.businessMetrics,
    workflows,
    alerts,
    trends,
  };
}

export function getSystemMetrics() {
  return store.systemMetrics;
}

export function getHealthData() {
  return {
    score: 87,
    dimensions: [
      { label: "订单缺陷率", score: 95, value: "0.8%", threshold: "< 1%", status: "pass" as const },
      { label: "迟发率", score: 88, value: "2.1%", threshold: "< 4%", status: "pass" as const },
      { label: "侵权风险", score: 72, value: "1 次投诉", threshold: "0 次", status: "warning" as const },
      { label: "绩效通知", score: 90, value: "1 条未处理", threshold: "0 条", status: "warning" as const },
      { label: "政策合规", score: 96, value: "96 分", threshold: "> 90 分", status: "pass" as const },
    ],
    indicators: [
      { name: "ODR (订单缺陷率)", current: "0.8%", threshold: "< 1%", status: "safe" as const, trend: [1.2, 1.1, 0.9, 0.8, 0.7, 0.8, 0.8] },
      { name: "A-to-Z 索赔率", current: "0.3%", threshold: "< 0.5%", status: "safe" as const, trend: [0.5, 0.4, 0.3, 0.3, 0.2, 0.3, 0.3] },
      { name: "差评率", current: "1.2%", threshold: "< 2%", status: "safe" as const, trend: [2.1, 1.8, 1.5, 1.3, 1.2, 1.1, 1.2] },
      { name: "迟发率", current: "2.1%", threshold: "< 4%", status: "safe" as const, trend: [3.5, 3.0, 2.8, 2.5, 2.2, 2.0, 2.1] },
      { name: "退货率", current: "3.8%", threshold: "< 5%", status: "safe" as const, trend: [4.2, 4.0, 3.9, 3.7, 3.6, 3.8, 3.8] },
      { name: "知识产权投诉", current: "1", threshold: "0", status: "warning" as const, trend: [0, 0, 0, 1, 1, 1, 1] },
      { name: "账号健康评分", current: "87", threshold: "> 90", status: "warning" as const, trend: [92, 91, 90, 89, 88, 87, 87] },
    ],
  };
}
