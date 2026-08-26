"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { StatusDot } from "@/components/ui/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dna,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Zap,
  Brain,
} from "lucide-react";
import type { EvolutionRecord } from "@/lib/types";

const AnimatedNumber = dynamic(
  () => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })),
  { ssr: false }
);

const Sparkline = dynamic(
  () => import("@/components/ui/sparkline").then((m) => ({ default: m.Sparkline })),
  { ssr: false }
);

const stageConfig: Record<EvolutionRecord["stage"], { label: string; color: string; bg: string }> = {
  identify: { label: "识别", color: "text-blue-500", bg: "bg-blue-500/10" },
  generate: { label: "生成", color: "text-purple-500", bg: "bg-purple-500/10" },
  test: { label: "测试", color: "text-amber-500", bg: "bg-amber-500/10" },
  review: { label: "评审", color: "text-orange-500", bg: "bg-orange-500/10" },
  reuse: { label: "复用", color: "text-emerald-500", bg: "bg-emerald-500/10" },
};

const statusConfig = {
  in_progress: { label: "进行中", icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/10", dot: "info" as const },
  success: { label: "成功", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "success" as const },
  failed: { label: "失败", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10", dot: "danger" as const },
};

interface EvolutionClientProps {
  initialData: EvolutionRecord[];
}

export function EvolutionClient({ initialData }: EvolutionClientProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const evolutionTrend = [45, 52, 58, 63, 68, 72];
  const evolutionTrendLabels = ["1月", "2月", "3月", "4月", "5月", "6月"];

  return (
    <PageTransition className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">自进化系统</h1>
          <p className="text-muted-foreground text-sm">
            监控和管理 Agent 自我优化的记录与趋势
          </p>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Zap className="h-3 w-3" /> 总优化次数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatedNumber value={initialData.length} className="text-2xl font-bold" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> 成功率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {initialData.length > 0 ? Math.round((initialData.filter((r) => r.status === "success").length / initialData.length) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Brain className="h-3 w-3 text-primary" /> 进行中
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatedNumber value={initialData.filter((r) => r.status === "in_progress").length} className="text-2xl font-bold" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            进化趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Sparkline data={evolutionTrend} width={400} height={60} color="var(--primary)" />
              <div className="flex justify-between mt-1">
                {evolutionTrendLabels.map((label) => (
                  <span key={label} className="text-[10px] text-muted-foreground">{label}</span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Dna className="h-4 w-4 text-primary" />
            进化记录
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {initialData.map((record) => {
              const status = statusConfig[record.status];
              const stage = stageConfig[record.stage];
              const isExpanded = expandedId === record.id;
              const StatusIcon = status.icon;
              return (
                <div key={record.id}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  >
                    <StatusDot status={status.dot} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{record.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {record.startedAt}
                        </span>
                        <Badge variant="outline" className={cn(stage.color, stage.bg, "border-0 text-[10px] h-4")}>
                          {stage.label}
                        </Badge>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(status.color, status.bg, "border-0 text-xs")}>
                      <StatusIcon className={cn("h-3 w-3 mr-1", record.status === "in_progress" && "animate-spin")} />
                      {status.label}
                    </Badge>
                    {record.metrics && (
                      <span className="text-xs text-emerald-500 font-medium">{Math.round(record.metrics.accuracy * 100)}%</span>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 pl-10 space-y-4">
                      <p className="text-xs text-muted-foreground">{record.description}</p>
                      {record.completedAt && (
                        <p className="text-xs text-muted-foreground">完成于: {record.completedAt}</p>
                      )}
                      {record.metrics && (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded border p-2 text-center">
                            <p className="text-xs text-muted-foreground">准确率</p>
                            <p className="text-sm font-bold text-emerald-500">{Math.round(record.metrics.accuracy * 100)}%</p>
                          </div>
                          <div className="rounded border p-2 text-center">
                            <p className="text-xs text-muted-foreground">延迟</p>
                            <p className="text-sm font-bold">{record.metrics.latency}ms</p>
                          </div>
                          <div className="rounded border p-2 text-center">
                            <p className="text-xs text-muted-foreground">覆盖率</p>
                            <p className="text-sm font-bold">{Math.round(record.metrics.coverage * 100)}%</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {initialData.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Dna className="h-8 w-8 mb-2" />
                <p className="text-sm">暂无进化记录</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </PageTransition>
  );
}
