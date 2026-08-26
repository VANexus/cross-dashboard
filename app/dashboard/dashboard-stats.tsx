"use client";

import dynamic from "next/dynamic";
import { Workflow, Bot, ListTodo, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/lib/types";

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

/** 设计稿 KPI 迷你图（每卡一个固定波形 path） */
const sparklines = [
  "M2 26 L16 22 L30 24 L44 16 L58 18 L72 10 L94 8",
  "M2 20 L16 14 L30 17 L44 12 L58 13 L72 9 L94 11",
  "M2 24 L16 20 L30 22 L44 15 L58 16 L72 8 L94 5",
  "M2 8 L16 10 L30 9 L44 18 L58 17 L72 24 L94 28",
];

function KpiCard({
  icon,
  label,
  value,
  unit,
  delta,
  deltaTone,
  sparkColor,
  sparkPath,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  delta: string;
  deltaTone: "up" | "down" | "warn" | "muted";
  sparkColor: string;
  sparkPath: string;
  delay: number;
}) {
  return (
    <div className="glass glass-hover dash-kpi dash-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="dash-kpi-top">
        <span className="dash-kpi-label">
          {icon}
          {label}
        </span>
      </div>
      <div className="dash-kpi-value">
        <AnimatedNumber value={value} className="num" />
        <span className="unit">{unit}</span>
      </div>
      <div className="dash-kpi-foot">
        <span className={cn("dash-kpi-delta", deltaTone)}>{delta}</span>
        <svg className="dash-kpi-spark" viewBox="0 0 96 34" preserveAspectRatio="none" aria-hidden="true">
          <path d={sparkPath} fill="none" stroke={sparkColor} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

export function DashboardStatsCards({ stats, workflowCount, runningCount, warningCount }: DashboardStatsProps) {
  return (
    <div className="dash-kpi-grid">
      <KpiCard
        icon={<Workflow className="h-3.5 w-3.5" />}
        label="运行中工作流"
        value={runningCount}
        unit={`/ ${workflowCount} 个`}
        delta={warningCount > 0 ? `${warningCount} 告警` : "全部正常"}
        deltaTone={warningCount > 0 ? "warn" : "up"}
        sparkColor="var(--primary)"
        sparkPath={sparklines[0]}
        delay={0}
      />
      <KpiCard
        icon={<Bot className="h-3.5 w-3.5" />}
        label="在线 Agent"
        value={stats.onlineAgents}
        unit={`/ ${stats.totalAgents} 个`}
        delta="心跳正常"
        deltaTone="up"
        sparkColor="var(--success)"
        sparkPath={sparklines[1]}
        delay={50}
      />
      <KpiCard
        icon={<ListTodo className="h-3.5 w-3.5" />}
        label="已完成任务"
        value={stats.completedTasks}
        unit="个"
        delta={`${stats.runningTasks} 运行中`}
        deltaTone="muted"
        sparkColor="var(--info)"
        sparkPath={sparklines[2]}
        delay={100}
      />
      <KpiCard
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        label="风险事件 · 24h"
        value={stats.riskEvents24h}
        unit="起"
        delta={stats.riskEvents24h > 0 ? "需处理" : "无风险"}
        deltaTone={stats.riskEvents24h > 0 ? "down" : "up"}
        sparkColor="var(--destructive)"
        sparkPath={sparklines[3]}
        delay={150}
      />
    </div>
  );
}
