"use client";

import { StatsOverview } from "@/components/dashboard/stats-overview";
import { AgentStatusCard } from "@/components/dashboard/agent-status-card";
import { TaskOverviewChart } from "@/components/dashboard/task-overview-chart";
import { SystemMetricsPanel } from "@/components/dashboard/system-metrics";
import { RiskAlerts } from "@/components/dashboard/risk-alerts";
import { agents } from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>
        <p className="text-sm text-muted-foreground">
          FlowMind 系统运行概览 — 实时监控所有 Agent 和任务状态
        </p>
      </div>

      <StatsOverview />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TaskOverviewChart />
        </div>
        <div>
          <SystemMetricsPanel />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Agent 状态</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentStatusCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      <RiskAlerts />
    </div>
  );
}
