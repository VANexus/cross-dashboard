"use client";

import dynamic from "next/dynamic";
import { Workflow, Bot, ListTodo, AlertTriangle } from "lucide-react";
import type { DashboardStats, WorkflowStatus } from "@/lib/types";

const AnimatedNumber = dynamic(
  () => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })),
  { ssr: false }
);

interface DashboardStatsProps {
  stats: DashboardStats;
  workflowCount: number;
  runningCount: number;
  warningCount: number;
}

export function DashboardStatsCards({ stats, workflowCount, runningCount, warningCount }: DashboardStatsProps) {
  return (
    <div className="data-grid grid-cols-2 md:grid-cols-4">
      <div className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Workflow className="h-3 w-3" /> 工作流
        </span>
        <div className="flex items-baseline gap-2">
          <AnimatedNumber value={workflowCount} className="text-2xl font-bold" />
          <span className="text-xs text-muted-foreground">
            <span className="text-emerald-500">{runningCount} 运行中</span>
            {warningCount > 0 && <span className="text-amber-500 ml-2">{warningCount} 告警</span>}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Bot className="h-3 w-3" /> Agent
        </span>
        <div className="flex items-baseline gap-2">
          <AnimatedNumber value={stats.totalAgents} className="text-2xl font-bold" />
          <span className="text-xs text-emerald-500">{stats.onlineAgents} 在线</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ListTodo className="h-3 w-3" /> 任务
        </span>
        <div className="flex items-baseline gap-2">
          <AnimatedNumber value={stats.completedTasks} className="text-2xl font-bold" />
          <span className="text-xs text-muted-foreground">{stats.runningTasks} 运行中</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3" /> 告警
        </span>
        <div className="flex items-baseline gap-2">
          <AnimatedNumber value={stats.riskEvents24h} className="text-2xl font-bold" />
          <span className="text-xs text-amber-500">需处理</span>
        </div>
      </div>
    </div>
  );
}
