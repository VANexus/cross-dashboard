"use client";

import dynamic from "next/dynamic";
import { PageTransition } from "@/components/ui/page-transition";
import { StatusDot } from "@/components/ui/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const workflows = [
  { name: "选品工作流", href: "/workflows/product-research", icon: <Radar className="h-4 w-4" />, status: "running" as const, lastRun: "3分钟前", runs: 128, success: 94 },
  { name: "AI 作图", href: "/workflows/ai-imaging", icon: <Image className="h-4 w-4" />, status: "idle" as const, lastRun: "1小时前", runs: 86, success: 91 },
  { name: "AI 广告", href: "/workflows/ai-advertising", icon: <BarChart3 className="h-4 w-4" />, status: "running" as const, lastRun: "12分钟前", runs: 203, success: 89 },
  { name: "AI 上架", href: "/workflows/ai-listing", icon: <PackagePlus className="h-4 w-4" />, status: "idle" as const, lastRun: "2小时前", runs: 67, success: 97 },
  { name: "库销比", href: "/workflows/inventory", icon: <Boxes className="h-4 w-4" />, status: "warning" as const, lastRun: "30分钟前", runs: 45, success: 96 },
  { name: "竞品广告分析", href: "/workflows/competitor-ads", icon: <Target className="h-4 w-4" />, status: "idle" as const, lastRun: "4小时前", runs: 34, success: 88 },
];

const alerts = [
  { level: "danger" as const, message: "库销比预警: SKU-A001 库存可售78天", time: "5分钟前", href: "/workflows/inventory" },
  { level: "warning" as const, message: "账号风险: 绩效通知待处理", time: "30分钟前", href: "/risk" },
  { level: "info" as const, message: "AI 广告: 3个高ACOS词已标记", time: "1小时前", href: "/workflows/ai-advertising" },
  { level: "info" as const, message: "选品完成: 发现2个潜力爆款市场", time: "2小时前", href: "/workflows/product-research" },
];

const salesTrend = [4200, 4800, 4100, 5600, 5200, 6100, 5800];
const acosTrend = [32, 28, 35, 26, 24, 22, 20];
const conversionTrend = [12.1, 13.5, 11.8, 14.2, 15.1, 14.8, 16.2];

interface DashboardClientProps {
  initialData: {
    metrics: {
      activeWorkflows: { value: number; change: number };
      completedToday: { value: number; change: number };
      activeAlerts: { value: number; change: number };
      successRate: { value: number; change: number };
    };
    salesTrend: number[];
    acosTrend: number[];
    conversionTrend: number[];
    alerts: {
      id: string;
      type: string;
      message: string;
      time: string;
      severity: "warning" | "danger";
    }[];
  };
}

export function DashboardClient({ initialData }: DashboardClientProps) {
  const runningCount = workflows.filter((w) => w.status === "running").length;
  const warningCount = workflows.filter((w) => w.status === "warning").length;

  return (
    <PageTransition className="space-y-6">
      <div className="data-grid grid-cols-2 md:grid-cols-4">
        <div className="flex flex-col gap-1 p-4">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Workflow className="h-3 w-3" /> 工作流
          </span>
          <div className="flex items-baseline gap-2">
            <AnimatedNumber value={6} className="text-2xl font-bold" />
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
            <AnimatedNumber value={6} className="text-2xl font-bold" />
            <span className="text-xs text-emerald-500">全部在线</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 p-4">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ListTodo className="h-3 w-3" /> 任务
          </span>
          <div className="flex items-baseline gap-2">
            <AnimatedNumber value={initialData.metrics.completedToday.value} className="text-2xl font-bold" />
            <span className="text-xs text-muted-foreground">运行中</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 p-4">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" /> 告警
          </span>
          <div className="flex items-baseline gap-2">
            <AnimatedNumber value={initialData.metrics.activeAlerts.value} className="text-2xl font-bold" />
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
                  key={wf.href}
                  href={wf.href}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <StatusDot
                    status={wf.status === "running" ? "success" : wf.status === "warning" ? "warning" : "idle"}
                    pulse={wf.status === "running"}
                  />
                  <span className="text-muted-foreground">{wf.icon}</span>
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
            {alerts.map((a, i) => (
              <Link
                key={i}
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
              <AnimatedNumber value={initialData.salesTrend[initialData.salesTrend.length - 1] || 5800} prefix="$" className="text-2xl font-bold" />
              <Sparkline data={initialData.salesTrend.length > 0 ? initialData.salesTrend : salesTrend} width={100} height={32} color="var(--success)" />
            </div>
            <p className="text-[11px] text-emerald-500 mt-1">
              ↑ {initialData.metrics.completedToday.change}% vs 上周
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
              <AnimatedNumber value={initialData.acosTrend[initialData.acosTrend.length - 1] || 20} suffix="%" className="text-2xl font-bold" />
              <Sparkline data={initialData.acosTrend.length > 0 ? initialData.acosTrend : acosTrend} width={100} height={32} color="var(--primary)" />
            </div>
            <p className="text-[11px] text-emerald-500 mt-1">
              ↓ {Math.abs(initialData.metrics.successRate.change)}% vs 上月
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
              <AnimatedNumber value={initialData.conversionTrend[initialData.conversionTrend.length - 1] || 16.2} suffix="%" decimals={1} className="text-2xl font-bold" />
              <Sparkline data={initialData.conversionTrend.length > 0 ? initialData.conversionTrend : conversionTrend} width={100} height={32} color="var(--info)" />
            </div>
            <p className="text-[11px] text-emerald-500 mt-1">
              ↑ {initialData.metrics.activeWorkflows.change}% vs 上月
            </p>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
