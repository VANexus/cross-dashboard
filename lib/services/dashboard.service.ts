/**
 * FlowMind RAK — Dashboard Service
 * Aggregated dashboard data from all domains
 */
import os from "os";
import { getSupabase } from "../db";
import * as agentRepo from "../repositories/agent.repository";
import * as taskRepo from "../repositories/task.repository";
import * as riskRepo from "../repositories/risk.repository";
import { parseJsonField } from "../repositories/base";
import type {
  DashboardStats, SystemMetrics, BusinessMetrics,
  Alert, WorkflowStatus,
} from "../types";
import * as workflowRepo from "../repositories/workflow.repository";

export class DashboardService {
  async getStats(): Promise<DashboardStats> {
    const agents = await agentRepo.getAgents();
    const tasks = await taskRepo.getTasks({ pageSize: 10000 });
    const risks = await riskRepo.getRiskEvents({});

    return {
      totalAgents: agents.length,
      onlineAgents: agents.filter((a) => a.status === "online").length,
      busyAgents: agents.filter((a) => a.status === "busy").length,
      errorAgents: agents.filter((a) => a.status === "error").length,
      offlineAgents: agents.filter((a) => a.status === "offline").length,
      totalTasks: tasks.pagination.total,
      runningTasks: tasks.items.filter((t) => t.status === "running").length,
      completedTasks: tasks.items.filter((t) => t.status === "completed").length,
      failedTasks: tasks.items.filter((t) => t.status === "failed").length,
      riskEvents24h: risks.items.length,
      activeCircuitBreakers: 1,
    };
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const sb = getSupabase();

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

    const { count: totalCount } = await sb.from("tasks").select("*", { count: "exact", head: true });
    const { count: completedCount } = await sb.from("tasks").select("*", { count: "exact", head: true }).eq("status", "completed");
    const { count: queuedCount } = await sb.from("tasks").select("*", { count: "exact", head: true }).in("status", ["pending", "running"]);
    const { count: failedCount } = await sb.from("tasks").select("*", { count: "exact", head: true }).eq("status", "failed");
    const { count: onlineAgentCount } = await sb.from("agents").select("*", { count: "exact", head: true }).in("status", ["online", "busy"]);

    const total = totalCount ?? 0;
    const completed = completedCount ?? 0;
    const queued = queuedCount ?? 0;
    const failed = failedCount ?? 0;
    const onlineAgents = onlineAgentCount ?? 0;

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
    const sb = getSupabase();

    const { data: invRows } = await sb.from("wf_inventory").select("daily_sales, stock, avg_cost");
    let productCount = 0;
    let totalDailySales = 0;
    let totalStock = 0;
    let inventoryValue = 0;
    for (const r of (invRows ?? []) as Array<{ daily_sales: number | null; stock: number | null; avg_cost: number | null }>) {
      productCount += 1;
      totalDailySales += r.daily_sales ?? 0;
      totalStock += r.stock ?? 0;
      inventoryValue += (r.stock ?? 0) * (r.avg_cost ?? 0);
    }

    const inventoryTurnover = totalStock > 0
      ? Math.round((totalDailySales * 365 / totalStock) * 10) / 10
      : 0;

    const { count: unresolved } = await sb.from("risk_events").select("*", { count: "exact", head: true }).eq("resolved", false);
    const { count: level1 } = await sb.from("risk_events").select("*", { count: "exact", head: true }).eq("level", "level1").eq("resolved", false);
    const accountHealth = Math.max(0, 100 - (unresolved ?? 0) * 5 - (level1 ?? 0) * 15);

    const { data: adRows } = await sb.from("wf_ad_keywords").select("spend, sales, conversion");
    let totalSpend = 0;
    let totalSales = 0;
    let convSum = 0;
    let convCount = 0;
    for (const r of (adRows ?? []) as Array<{ spend: number | null; sales: number | null; conversion: number | null }>) {
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

  async getTrends() {
    const sb = getSupabase();
    const DAYS = 7;

    const { data: rows } = await sb.from("wf_ad_keywords").select("trend, sales, spend, conversion");
    const typedRows = (rows ?? []) as Array<{ trend: string | null; sales: number | null; spend: number | null; conversion: number | null }>;

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
