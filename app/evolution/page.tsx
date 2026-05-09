"use client";

import { useState } from "react";
import { evolutionRecords, agents } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils";
import {
  Target,
  Code2,
  FlaskConical,
  ShieldCheck,
  Share2,
  CheckCircle2,
  Clock,
  RotateCw,
  TrendingUp,
} from "lucide-react";

const stageConfig = {
  identify: { label: "需求识别", color: "#6366f1", icon: Target },
  generate: { label: "代码生成", color: "#8b5cf6", icon: Code2 },
  test: { label: "沙箱测试", color: "#f59e0b", icon: FlaskConical },
  review: { label: "审查归档", color: "#06b6d4", icon: ShieldCheck },
  reuse: { label: "能力复用", color: "#10b981", icon: Share2 },
};

const stageOrder = ["identify", "generate", "test", "review", "reuse"] as const;

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "danger" | "secondary" | "default" }> = {
  success: { label: "已完成", variant: "success" },
  in_progress: { label: "进行中", variant: "warning" },
  failed: { label: "失败", variant: "danger" },
};

const beforeMetrics: Record<string, { accuracy: number; latency: number; coverage: number }> = {
  "1": { accuracy: 72, latency: 450, coverage: 60 },
  "3": { accuracy: 58, latency: 380, coverage: 45 },
};

const evolutionTrend = [2, 3, 1, 4, 3, 5];
const evolutionTrendLabels = ["12月", "1月", "2月", "3月", "4月", "5月"];

export default function EvolutionPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalProjects = evolutionRecords.length;
  const successCount = evolutionRecords.filter((r) => r.stage === "reuse").length;
  const inProgressCount = evolutionRecords.filter((r) => r.status === "in_progress").length;
  const successRate = totalProjects > 0 ? Math.round((successCount / totalProjects) * 100) : 0;

  const getAgentName = (id: string) => agents.find((a) => a.id === id)?.name || id;

  const completedStages = new Set(
    evolutionRecords.filter((r) => r.status === "success").map((r) => r.stage)
  );
  const currentStage = stageOrder.find((s) =>
    evolutionRecords.some((r) => r.stage === s && r.status === "in_progress")
  );

  const metrics = [
    { label: "进化项目", value: totalProjects, color: "text-foreground", icon: RotateCw },
    { label: "已成功复用", value: successCount, color: "text-emerald-500", icon: CheckCircle2 },
    { label: "进行中", value: inProgressCount, color: "text-amber-500", icon: Clock },
    { label: "成功率", value: successRate, suffix: "%", color: "text-indigo-400", icon: TrendingUp },
  ];

  const renderPipeline = () => (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-4">进化流水线</h3>
        <div className="flex items-center justify-between gap-1">
          {stageOrder.map((stage, i) => {
            const sc = stageConfig[stage];
            const Icon = sc.icon;
            const isCompleted = completedStages.has(stage);
            const isCurrent = currentStage === stage;
            const isLast = i === stageOrder.length - 1;
            const stageRecords = evolutionRecords.filter((r) => r.stage === stage);
            const completedInStage = stageRecords.filter((r) => r.status === "success").length;

            return (
              <div key={stage} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                      isCurrent && "ring-2 ring-offset-2 ring-offset-background animate-pulse"
                    )}
                    style={{
                      backgroundColor: isCompleted ? sc.color : "var(--muted)",
                    }}
                  >
                    <Icon className={cn("h-5 w-5", isCompleted || isCurrent ? "text-white" : "text-muted-foreground")} />
                  </div>
                  <span className="text-[10px] font-medium mt-1.5 text-center">{sc.label}</span>
                  <span className="text-[9px] text-muted-foreground">
                    {completedInStage}/{stageRecords.length}
                  </span>
                </div>
                {!isLast && (
                  <div className="flex-1 mx-1">
                    <div
                      className={cn(
                        "h-0.5 w-full rounded-full",
                        isCompleted && completedStages.has(stageOrder[i + 1])
                          ? "bg-emerald-500"
                          : isCurrent
                          ? "bg-amber-500 animate-pulse"
                          : "border-t border-dashed border-muted-foreground/30"
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  const renderBeforeAfter = (recordId: string) => {
    const before = beforeMetrics[recordId];
    if (!before) return null;

    const record = evolutionRecords.find((r) => r.id === recordId);
    if (!record?.metrics) return null;

    const comparisons = [
      { label: "准确率", before: before.accuracy, after: record.metrics.accuracy, unit: "%", max: 100 },
      { label: "延迟", before: before.latency, after: record.metrics.latency, unit: "ms", max: 500, lowerBetter: true },
      { label: "覆盖率", before: before.coverage, after: record.metrics.coverage, unit: "%", max: 100 },
    ];

    return (
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 rounded-lg border border-border/50 overflow-hidden">
        <div className="p-3 bg-muted/30">
          <div className="text-[10px] text-muted-foreground font-medium mb-2">优化前</div>
          {comparisons.map((c) => (
            <div key={c.label} className="mb-2 last:mb-0">
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-muted-foreground">{c.label}</span>
                <span className="font-mono">{c.before}{c.unit}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-zinc-500/60 transition-all"
                  style={{ width: `${(c.before / c.max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 bg-emerald-500/5">
          <div className="text-[10px] text-emerald-500 font-medium mb-2">优化后</div>
          {comparisons.map((c) => {
            const improved = c.lowerBetter ? c.after < c.before : c.after > c.before;
            return (
              <div key={c.label} className="mb-2 last:mb-0">
                <div className="flex items-center justify-between text-[10px] mb-0.5">
                  <span className="text-emerald-400">{c.label}</span>
                  <span className="font-mono flex items-center gap-1">
                    <AnimatedNumber value={c.after} />
                    {c.unit}
                    {improved && (
                      <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />
                    )}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${(c.after / c.max) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">自进化系统</h1>
          <p className="text-sm text-muted-foreground">智能体能力自我迭代和进化</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <Card key={m.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn("rounded-lg p-2", m.label === "已成功复用" ? "bg-emerald-500/10" : m.label === "进行中" ? "bg-amber-500/10" : m.label === "成功率" ? "bg-indigo-500/10" : "bg-muted")}>
                    <Icon className={cn("h-4 w-4", m.color)} />
                  </div>
                  <div>
                    <div className={cn("text-2xl font-bold tabular-nums", m.color)}>
                      <AnimatedNumber value={m.value} />
                      {m.suffix}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{m.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {renderPipeline()}

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">进化成功趋势</h3>
              <span className="text-[10px] text-muted-foreground">近6个月</span>
            </div>
            <div className="flex items-center gap-3">
              <Sparkline data={evolutionTrend} width={200} height={40} color="var(--primary)" />
              <div className="flex gap-2">
                {evolutionTrendLabels.map((label) => (
                  <span key={label} className="text-[9px] text-muted-foreground">{label}</span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">全部 ({evolutionRecords.length})</TabsTrigger>
            <TabsTrigger value="in_progress">
              进行中 ({evolutionRecords.filter((r) => r.status === "in_progress").length})
            </TabsTrigger>
            <TabsTrigger value="success">
              已完成 ({evolutionRecords.filter((r) => r.status === "success").length})
            </TabsTrigger>
          </TabsList>
          {(["all", "in_progress", "success"] as const).map((status) => (
            <TabsContent key={status} value={status} className="mt-4 space-y-3">
              {evolutionRecords
                .filter((r) => status === "all" || r.status === status)
                .map((record) => {
                  const sc = stageConfig[record.stage];
                  const st = statusConfig[record.status];
                  const Icon = sc.icon;
                  const isExpanded = expandedId === record.id;
                  const isCompleted = record.status === "success";
                  const hasBeforeAfter = isCompleted && beforeMetrics[record.id];

                  return (
                    <Card
                      key={record.id}
                      className={cn(
                        "group transition-all cursor-pointer",
                        record.status === "in_progress" ? "border-amber-500/30" : "hover:border-primary/30"
                      )}
                      onClick={() => setExpandedId(isExpanded ? null : record.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                              record.status === "in_progress" && "animate-pulse"
                            )}
                            style={{
                              backgroundColor: `color-mix(in srgb, ${sc.color} 20%, transparent)`,
                            }}
                          >
                            <Icon className="h-[18px] w-[18px]" style={{ color: sc.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="text-sm font-semibold">{record.title}</h3>
                              <Badge variant={st.variant} className="text-[9px]">
                                {record.status === "in_progress" && (
                                  <RotateCw className="h-2.5 w-2.5 mr-0.5 animate-spin" />
                                )}
                                {st.label}
                              </Badge>
                              <Badge variant="outline" className="text-[9px]" style={{ borderColor: sc.color, color: sc.color }}>
                                {sc.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {record.description}
                            </p>
                            <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-2">
                              <span>Agent: {getAgentName(record.agentId)}</span>
                              <span>{record.startedAt}</span>
                              {record.completedAt && <span>完成: {record.completedAt}</span>}
                            </div>
                            {record.metrics && (
                              <div className="flex gap-4 text-xs">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  准确率:
                                  <span className="font-mono text-foreground">{record.metrics.accuracy}%</span>
                                </span>
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  延迟:
                                  <span className="font-mono text-foreground">{record.metrics.latency}ms</span>
                                </span>
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  覆盖率:
                                  <span className="font-mono text-foreground">{record.metrics.coverage}%</span>
                                </span>
                              </div>
                            )}
                            {record.status === "in_progress" && (
                              <div className="mt-2">
                                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-amber-500 animate-flow-progress"
                                    style={{ width: "40%" }}
                                  />
                                </div>
                                <div className="flex items-center justify-between text-[9px] text-muted-foreground mt-1">
                                  <span>进度约 40%</span>
                                  <span>预计剩余 2天</span>
                                </div>
                              </div>
                            )}
                            {isExpanded && hasBeforeAfter && renderBeforeAfter(record.id)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              {evolutionRecords.filter((r) => status === "all" || r.status === status).length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <RotateCw className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">暂无进化记录</p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </PageTransition>
  );
}
