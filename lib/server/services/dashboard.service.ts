/**
 * FlowMind RAK — Dashboard Service
 * Aggregated dashboard data from all domains
 */
import os from "os";
import { cache } from "react";
import { prisma } from "../db";
import * as riskRepo from "../repositories/risk.repository";
import { parseJsonField } from "../repositories/base";
import { getAgentsShared } from "../repositories/agent.repository";
import type {
  DashboardStats, SystemMetrics, BusinessMetrics,
  Alert, WorkflowStatus,
} from "@/lib/shared/types";
import * as workflowRepo from "../repositories/workflow.repository";
import { getMCPCircuitStatus } from "../mastra/tools/mcp-tools";

export class DashboardService {
  async getStats(): Promise<DashboardStats> {
    const agents = await getAgentsShared();
    const risks = await riskRepo.getRiskEvents({});

    // 单次 select 拉回 status 列本地聚合，替代 4 次独立 count 远程往返
    const taskRows = await prisma.tasks.findMany({ select: { status: true } });
    const statuses = taskRows.map((r) => r.status);
    const totalTasks = statuses.length;
    const runningTasks = statuses.filter((s) => s === "running").length;
    const completedTasks = statuses.filter((s) => s === "completed").length;
    const failedTasks = statuses.filter((s) => s === "failed").length;

    return {
      totalAgents: agents.length,
      onlineAgents: agents.filter((a) => a.status === "online").length,
      busyAgents: agents.filter((a) => a.status === "busy").length,
      errorAgents: agents.filter((a) => a.status === "error").length,
      offlineAgents: agents.filter((a) => a.status === "offline").length,
      totalTasks,
      runningTasks,
      completedTasks,
      failedTasks,
      riskEvents24h: risks.items.length,
      activeCircuitBreakers: getMCPCircuitStatus().open,
    };
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const cpuRaw = (os.loadavg() || [0])[0];
    const cpuCores = Math.max(1, os.cpus?.()?.length || 1);
    const cpu = Math.min(100, Math.round((cpuRaw / cpuCores) * 100));

    let totalMem = 16 * 1024 * 1024 * 1024;
    let freeMem = 8 * 1024 * 1024 * 1024;
    try {
      totalMem = os.totalmem?.() || totalMem;
      freeMem = os.freemem?.() || freeMem;
    } catch {}
    const memory = Math.round(((totalMem - freeMem) / totalMem) * 100);

    // 单次 select 拉回 status 列本地聚合，替代 5 次独立 count 远程往返
    const taskRows = await prisma.tasks.findMany({ select: { status: true } });
    const statuses = taskRows.map((r) => r.status);
    const total = statuses.length;
    const completed = statuses.filter((s) => s === "completed").length;
    const queued = statuses.filter((s) => s === "pending" || s === "running").length;
    const failed = statuses.filter((s) => s === "failed").length;

    const agentRows = await prisma.agents.findMany({ select: { status: true } });
    const onlineAgents = agentRows.filter(
      (r) => r.status === "online" || r.status === "busy"
    ).length;

    return {
      cpu,
      memory,
      disk: 0,
      responseTime: 0,
      throughput: completed,
      activeConnections: onlineAgents,
      taskQueueLength: queued,
      errorRate: total > 0 ? Math.round((failed / total) * 1000) / 10 : 0,
    };
  }

  async getBusinessMetrics(): Promise<BusinessMetrics> {
    const invRows = await prisma.wf_inventory.findMany({ select: { daily_sales: true, stock: true, avg_cost: true } });
    let productCount = 0;
    let totalDailySales = 0;
    let totalStock = 0;
    let inventoryValue = 0;
    for (const r of invRows) {
      productCount += 1;
      totalDailySales += r.daily_sales ?? 0;
      totalStock += r.stock ?? 0;
      inventoryValue += (r.stock ?? 0) * (r.avg_cost ?? 0);
    }

    const inventoryTurnover = totalStock > 0
      ? Math.round((totalDailySales * 365 / totalStock) * 10) / 10
      : 0;

    // 单次 select 拉回 level/resolved 列本地聚合，替代 2 次独立 count 远程往返
    // 注意：resolved 列兼容 boolean(false) 与 integer(0) 两种表示，统一用 truthy 判断
    const riskRows = await prisma.risk_events.findMany({ select: { level: true, resolved: true } });
    const unresolved = riskRows.filter((r) => !r.resolved).length;
    const level1 = riskRows.filter((r) => !r.resolved && r.level === "level1").length;
    const accountHealth = Math.max(0, 100 - unresolved * 5 - level1 * 15);

    const adRows = await prisma.wf_ad_keywords.findMany({ select: { spend: true, sales: true, conversion: true } });
    let totalSpend = 0;
    let totalSales = 0;
    let convSum = 0;
    let convCount = 0;
    for (const r of adRows) {
      totalSpend += r.spend ?? 0;
      totalSales += r.sales ?? 0;
      if (r.conversion != null) { convSum += r.conversion; convCount += 1; }
    }
    const adSpend = Math.round(totalSpend);
    const adRevenue = Math.round(totalSales);
    const adRoi = adSpend > 0 ? Math.round((adRevenue / adSpend) * 10) / 10 : 0;
    const conversionRate = convCount > 0 ? Math.round((convSum / convCount) * 10) / 10 : 0;

    const estimatedCost = Math.round(inventoryValue || 0);
    const profit = Math.max(0, adRevenue - adSpend - Math.round(estimatedCost * 0.3));

    return {
      operations: {
        productCount,
        inventoryTurnover,
        listingSuccessRate: 0,
        accountHealth,
      },
      marketing: {
        adSpend,
        adRoi,
        conversionRate,
        csResponseTime: 0,
      },
      finance: {
        revenue: adRevenue,
        profit,
        cashflow: 0,
        costBreakdown: [
          { category: "采购成本", amount: estimatedCost },
          { category: "广告费用", amount: adSpend },
          { category: "物流费用", amount: Math.round(estimatedCost * 0.15) },
          { category: "平台佣金", amount: Math.round(adRevenue * 0.08) },
        ],
      },
      legal: {
        patentsMonitored: 0,
        activeContracts: 0,
        openDisputes: unresolved ?? 0,
        complianceScore: accountHealth,
      },
    };
  }

  async getAlerts(): Promise<Alert[]> {
    const risks = await riskRepo.getRiskEvents({ resolved: false });
    return risks.items.slice(0, 5).map((r) => ({
      id: r.id,
      level: r.level === "level1" ? "danger" : r.level === "level2" ? "warning" : "info",
      message: r.title,
      time: r.timestamp,
      href: "/risk",
    }));
  }

  async getWorkflowStatuses(): Promise<WorkflowStatus[]> {
    return await workflowRepo.getWorkflowStatuses();
  }

  /**
   * Agent 动态工作流真实统计（替代预设 wf_workflow_statuses 假数据）：
   * specCount = 对话中 plan_workflow 规划的 SOP 数；running/success/failed = wf_workflow_runs 真实运行数。
   */
  async getAgentWorkflowTotals() {
    const [specCount, runRows] = await Promise.all([
      prisma.wf_workflow_specs.count().catch(() => 0),
      prisma.wf_workflow_runs.findMany({ select: { status: true } }).catch(() => [] as { status: string }[]),
    ]);
    const statuses = runRows.map((r) => r.status);
    return {
      specCount,
      runCount: statuses.length,
      running: statuses.filter((s) => s === "running").length,
      success: statuses.filter((s) => s === "success").length,
      failed: statuses.filter((s) => s === "failed" || s === "error").length,
    };
  }

  async getTrends() {
    const DAYS = 7;

    const rows = await prisma.wf_ad_keywords.findMany({
      select: { trend: true, sales: true, spend: true, conversion: true },
    });
    const typedRows = rows;

    if (typedRows.length === 0) {
      return { sales: Array(DAYS).fill(0), acos: Array(DAYS).fill(0), conversion: Array(DAYS).fill(0) };
    }

    const keywords = typedRows.map((r) => {
      const trendFull = parseJsonField<number[]>(r.trend, []);
      const trend = trendFull.slice(-DAYS);
      const avg = trend.length > 0 ? trend.reduce((a, b) => a + b, 0) / trend.length : 1;
      return { trend, avg, sales: r.sales ?? 0, spend: r.spend ?? 0, conversion: r.conversion ?? 0 };
    });

    const sales = Array(DAYS).fill(0);
    const spend = Array(DAYS).fill(0);
    const conversionWeighted = Array(DAYS).fill(0);
    const totalWeight = Array(DAYS).fill(0);

    for (const kw of keywords) {
      for (let i = 0; i < DAYS; i++) {
        const dayTrend = kw.trend[i] ?? kw.avg;
        const weight = kw.avg > 0 ? dayTrend / kw.avg : 1;
        sales[i] += kw.sales * weight / DAYS;
        spend[i] += kw.spend * weight / DAYS;
        conversionWeighted[i] += kw.conversion * dayTrend;
        totalWeight[i] += dayTrend;
      }
    }

    const salesRounded = sales.map((v) => Math.round(v));
    const acos = sales.map((s, i) => s > 0 ? Math.round((spend[i] / s) * 1000) / 10 : 0);
    const conversion = conversionWeighted.map((v, i) =>
      totalWeight[i] > 0 ? Math.round((v / totalWeight[i]) * 10) / 10 : 0
    );

    return { sales: salesRounded, acos, conversion };
  }

  async getDashboardData() {
    if (process.env.DASH_BENCH) {
      const g = globalThis as any;
      g.__dashExec = (g.__dashExec ?? 0) + 1;
      console.error(`[dash-bench] getDashboardData exec #${g.__dashExec} ts=${Date.now()}`);
    }
    const [stats, systemMetrics, businessMetrics, alerts, workflows, trends] = await Promise.all([
      this.getStats(),
      this.getSystemMetrics(),
      this.getBusinessMetrics(),
      this.getAlerts(),
      this.getWorkflowStatuses(),
      this.getTrends(),
    ]);
    return { stats, systemMetrics, businessMetrics, alerts, workflows, trends };
  }
}

/**
 * Dashboard 聚合数据的 RSC 请求级共享访问点。
 * React cache() 保证同一个 RSC render pass 内（dashboard 页面的多个 island）
 * 只执行一次 getDashboardData()，消除 3 个 island 各自查询导致的 3 倍往返；
 * 在 route handler / 非 render 作用域中 cache() 每次都会执行（与 getDbAsync 语义一致）。
 */
export const getDashboardDataShared = cache(async function getDashboardDataShared() {
  return new DashboardService().getDashboardData();
});
