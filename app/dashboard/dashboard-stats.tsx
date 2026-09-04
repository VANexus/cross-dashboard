"use client";

import dynamic from "next/dynamic";
import { Workflow, Bot, ListTodo, AlertTriangle, TrendingUp, Activity } from "lucide-react";
import type { DashboardStats } from "@/lib/shared/types";

const AnimatedNumber = dynamic(
  () => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })),
  { ssr: false }
);

interface DashboardStatsProps {
  stats: DashboardStats;
  workflowCount: number;
  runningCount: number;
  warningCount: number;
  /** 单屏紧凑模式（cockpit） */
  compact?: boolean;
}

/* 迷你趋势线 path（4 条，分别对应 4 个 KPI） */
const sparklines = [
  "M2 26 L16 22 L30 24 L44 16 L58 18 L72 10 L94 8",
  "M2 20 L16 14 L30 17 L44 12 L58 13 L72 9 L94 11",
  "M2 24 L16 20 L30 22 L44 15 L58 16 L72 8 L94 5",
  "M2 8 L16 10 L30 9 L44 18 L58 17 L72 24 L94 28",
];

/* ── 主 KPI（视觉焦点） ── */
function HeroKpi({
  cardId,
  value,
  total,
  warningCount,
  sparkPath,
  delay,
  compact,
}: {
  cardId: string;
  value: number;
  total: number;
  warningCount: number;
  sparkPath: string;
  delay: number;
  compact?: boolean;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div
      data-agent-card={cardId}
      data-kpi="hero"
      className={`glass dash-rise relative flex items-stretch justify-between ${
        compact ? "gap-3 p-3.5" : "gap-5 p-5"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* 左：主数值 */}
      <div className="flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
            <Workflow className="h-3.5 w-3.5" />
            <span>运行中工作流</span>
          </div>
          <div className={`mt-3 flex items-baseline gap-2 ${compact ? "" : "mt-3"}`}>
            <span
              className={`font-bold leading-none tracking-[-0.035em] tabular-nums ${
                compact ? "text-[32px]" : "text-[44px]"
              }`}
            >
              <AnimatedNumber value={value} className="num" />
            </span>
            <span className="text-[15px] text-muted-foreground">/ {total}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-success" />
            <span className="text-[12px] text-success">{pct}% 在线率</span>
          </div>
          {warningCount > 0 ? (
            <span className="flex items-center gap-1.5 text-[12px] text-warning">
              <AlertTriangle className="h-3 w-3" />
              {warningCount} 告警
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[12px] text-success">
              <Activity className="h-3 w-3" />
              全部正常
            </span>
          )}
        </div>
      </div>

      {/* 右：大趋势图 */}
      <div className="flex flex-col justify-end">
        <svg
          className={compact ? "w-[140px] h-12" : "w-[180px] h-16"}
          viewBox="0 0 120 48"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="hero-spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${sparkPath} L94 34 L2 34 Z`} fill="url(#hero-spark-fill)" />
          <path d={sparkPath} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {!compact && (
          <div className="mt-1 text-right font-mono text-[10px] text-muted-foreground/60">近 7 日趋势</div>
        )}
      </div>
    </div>
  );
}

/* ── 次级 KPI（紧凑竖版）── */
function MiniKpi({
  cardId,
  icon: Icon,
  label,
  value,
  suffix,
  delta,
  deltaTone,
  sparkColor,
  sparkPath,
  delay,
  compact,
}: {
  cardId: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  suffix: string;
  delta: string;
  deltaTone: "up" | "down" | "warn" | "muted";
  sparkColor: string;
  sparkPath: string;
  delay: number;
  compact?: boolean;
}) {
  const toneClass = {
    up: "text-success",
    down: "text-destructive",
    warn: "text-warning",
    muted: "text-muted-foreground",
  }[deltaTone];

  return (
    <div
      data-agent-card={cardId}
      data-kpi="mini"
      className={`glass dash-rise relative flex flex-col justify-between ${
        compact ? "p-3" : "p-3.5"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11.5px] text-muted-foreground">{label}</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span
              className={`font-bold leading-[1.1] tracking-[-0.025em] tabular-nums ${
                compact ? "text-[18px]" : "text-[22px]"
              }`}
            >
              <AnimatedNumber value={value} className="num" />
            </span>
            <span className="text-[11px] text-muted-foreground">{suffix}</span>
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className={`font-mono text-[11.5px] inline-flex items-center gap-1 ${toneClass}`}>
          {delta}
        </span>
        <svg className="h-6 w-[60px]" viewBox="0 0 96 24" preserveAspectRatio="none" aria-hidden="true">
          <path d={sparkPath} fill="none" stroke={sparkColor} strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
        </svg>
      </div>
    </div>
  );
}

export function DashboardStatsCards({ stats, workflowCount, runningCount, warningCount, compact }: DashboardStatsProps) {
  return (
    <div className={`grid grid-cols-[2fr_1fr_1fr] ${compact ? "gap-2.5" : "gap-3.5"}`}>
      {/* 主 KPI */}
      <HeroKpi
        cardId="workflows"
        value={runningCount}
        total={workflowCount}
        warningCount={warningCount}
        sparkPath={sparklines[0]}
        delay={0}
        compact={compact}
      />

      {/* 次 KPI 第一列 */}
      <div className={`flex flex-col ${compact ? "gap-2.5" : "gap-3.5"}`}>
        <MiniKpi
          cardId="agents"
          icon={Bot}
          label="在线 Agent"
          value={stats.onlineAgents}
          suffix={`/ ${stats.totalAgents}`}
          delta="运行正常"
          deltaTone="up"
          sparkColor="var(--success)"
          sparkPath={sparklines[1]}
          delay={60}
          compact={compact}
        />
        <MiniKpi
          cardId="tasks"
          icon={ListTodo}
          label="已完成任务"
          value={stats.completedTasks}
          suffix="个"
          delta={`${stats.runningTasks} 运行中`}
          deltaTone="muted"
          sparkColor="var(--info)"
          sparkPath={sparklines[2]}
          delay={120}
          compact={compact}
        />
      </div>

      {/* 次 KPI 第二列 */}
      <div className="flex flex-col">
        <MiniKpi
          cardId="risk"
          icon={AlertTriangle}
          label="风险事件 · 24h"
          value={stats.riskEvents24h}
          suffix="起"
          delta={stats.riskEvents24h > 0 ? "待处理" : "无告警"}
          deltaTone={stats.riskEvents24h > 0 ? "down" : "up"}
          sparkColor="var(--destructive)"
          sparkPath={sparklines[3]}
          delay={180}
          compact={compact}
        />
      </div>
    </div>
  );
}
