"use client";

import dynamic from "next/dynamic";
import { PageTransition } from "@/components/ui/page-transition";
import { StatusDot } from "@/components/ui/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DashboardStats, BusinessMetrics, WorkflowStatus, Alert } from "@/lib/types";
import {
  Workflow,
  Bot,
  ListTodo,
  AlertTriangle,
  Radar,
  Image,
  BarChart3,
  PackagePlus,
  Boxes,
  Target,
  ArrowRight,
  Clock,
  TrendingUp,
  Activity,
} from "lucide-react";
import Link from "next/link";

const AnimatedNumber = dynamic(
  () => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })),
  { ssr: false }
);

const Sparkline = dynamic(
  () => import("@/components/ui/sparkline").then((m) => ({ default: m.Sparkline })),
  { ssr: false }
);

const workflowIcons: Record<string, React.ReactNode> = {
  "product-research": <Radar className="h-4 w-4" />,
  "ai-imaging": <Image className="h-4 w-4" />,
  "ai-advertising": <BarChart3 className="h-4 w-4" />,
  "ai-listing": <PackagePlus className="h-4 w-4" />,
  "inventory": <Boxes className="h-4 w-4" />,
  "competitor-ads": <Target className="h-4 w-4" />,
};

interface DashboardClientProps {
  initialData: {
    stats: DashboardStats;
    businessMetrics: BusinessMetrics;
    workflows: WorkflowStatus[];
    alerts: Alert[];
    trends: {
      sales: number[];
      acos: number[];
      conversion: number[];
    };
  };
}

export function DashboardClient({ initialData }: DashboardClientProps) {
  const { stats, workflows, alerts, trends } = initialData;
  const runningCount = workflows.filter((w) => w.status === "running").length;
  const warningCount = workflows.filter((w) => w.status === "warning").length;

  const salesTrend = trends.sales;
  const acosTrend = trends.acos;
  const conversionTrend = trends.conversion;

  const salesChange = salesTrend.length >= 2
    ? Math.round(((salesTrend[salesTrend.length - 1] - salesTrend[0]) / salesTrend[0]) * 100)
    : 0;
  const acosChange = acosTrend.length >= 2
    ? Math.round(((acosTrend[acosTrend.length - 1] - acosTrend[0]) / acosTrend[0]) * 100)
    : 0;
  const conversionChange = conversionTrend.length >= 2
    ? Math.round(((conversionTrend[conversionTrend.length - 1] - conversionTrend[0]) / conversionTrend[0]) * 100)
    : 0;

  return (
    <PageTransition className="space-y-6">
      <div className="data-grid grid-cols-2 md:grid-cols-4">
        <div className="flex flex-col gap-1 p-4">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Workflow className="h-3 w-3" /> 工作流
          </span>
          <div className="flex items-baseline gap-2">
            <AnimatedNumber value={workflows.length} className="text-2xl font-bold" />
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

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">插件工作流状态</CardTitle>
              <Link href="/workflows/product-research">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
                  查看全部 <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {workflows.map((wf) => (
                <Link
                  key={wf.id}
                  href={wf.href}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <StatusDot
                    status={wf.status === "running" ? "success" : wf.status === "warning" ? "warning" : "idle"}
                    pulse={wf.status === "running"}
                  />
                  <span className="text-muted-foreground">{workflowIcons[wf.id] || <Workflow className="h-4 w-4" />}</span>
                  <span className="text-sm font-medium flex-1">{wf.name}</span>
                  <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {wf.lastRun}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">
                    {wf.runs}次
                  </Badge>
                  <span className="text-[11px] text-muted-foreground w-10 text-right">{wf.success}%</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Agent 心跳
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {["哨兵Agent", "调度Agent", "运营Agent", "风控Agent", "法务Agent", "营销Agent"].map((name, i) => (
              <div key={name} className="flex items-center gap-3">
                <StatusDot status="success" pulse size="sm" />
                <span className="text-sm flex-1">{name}</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: 12 }).map((_, j) => (
                    <div
                      key={j}
                      className="w-1 rounded-full bg-emerald-500"
                      style={{ height: `${8 + ((i * 3 + j * 7) % 12)}px`, opacity: j > 9 ? 0.3 : 0.7 + ((j * 5) % 3) * 0.1 }}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground w-12 text-right">
                  {99 - i}.{(i * 7) % 9}%
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> 最近告警
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {alerts.map((a) => (
              <Link
                key={a.id}
                href={a.href}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <StatusDot
                  status={a.level === "danger" ? "danger" : a.level === "warning" ? "warning" : "info"}
                />
                <span className="text-sm flex-1">{a.message}</span>
                <span className="text-[11px] text-muted-foreground/60">{a.time}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">近7天销售额</CardTitle>
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <AnimatedNumber value={salesTrend[salesTrend.length - 1] || 0} prefix="$" className="text-2xl font-bold" />
              <Sparkline data={salesTrend} width={100} height={32} color="var(--success)" />
            </div>
            <p className="text-[11px] text-emerald-500 mt-1">
              {salesChange >= 0 ? "↑" : "↓"} {Math.abs(salesChange)}% vs 上周
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">平均 ACOS</CardTitle>
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <AnimatedNumber value={acosTrend[acosTrend.length - 1] || 0} suffix="%" className="text-2xl font-bold" />
              <Sparkline data={acosTrend} width={100} height={32} color="var(--primary)" />
            </div>
            <p className="text-[11px] text-emerald-500 mt-1">
              ↓ {Math.abs(acosChange)}% vs 上月
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">转化率</CardTitle>
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <AnimatedNumber value={conversionTrend[conversionTrend.length - 1] || 0} suffix="%" decimals={1} className="text-2xl font-bold" />
              <Sparkline data={conversionTrend} width={100} height={32} color="var(--info)" />
            </div>
            <p className="text-[11px] text-emerald-500 mt-1">
              {conversionChange >= 0 ? "↑" : "↓"} {Math.abs(conversionChange)}% vs 上月
            </p>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
