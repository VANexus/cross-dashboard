"use client";

import { PageHeader } from "@/components/ui/page-header";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageTransition } from "@/components/ui/page-transition";
import { StatusDot } from "@/components/ui/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
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
  Play,
  History,
  ArrowRight,
  GitBranch,
} from "lucide-react";
import type { EvolutionRecord } from "@/lib/shared/types";

const AnimatedNumber = dynamic(
  () => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })),
  { ssr: false },
);

const stageConfig: Record<string, { label: string; desc: string }> = {
  identify: { label: "识别", desc: "采集真实 before 指标" },
  generate: { label: "生成", desc: "合成可复用能力洞见" },
  test: { label: "测试", desc: "校验非平凡与数据充分" },
  review: { label: "评审", desc: "判定成败" },
  reuse: { label: "复用", desc: "记忆入库 + 向量索引" },
};
const STAGES = ["identify", "generate", "test", "review", "reuse"] as const;

const statusConfig = {
  in_progress: { label: "进行中", icon: Loader2, variant: "secondary" as const, dot: "info" as const },
  success: { label: "成功", icon: CheckCircle2, variant: "success" as const, dot: "success" as const },
  failed: { label: "失败", icon: AlertTriangle, variant: "danger" as const, dot: "danger" as const },
};

export interface EvoMetricShape {
  taskCount?: number;
  successRate?: number;
  journalCount7d?: number;
  memoryCount?: number;
  dataSufficiency?: number;
  relevance?: number;
  insightLength?: number;
  latencyMs?: number;
}

interface EvolutionClientProps {
  initialData: EvolutionRecord[];
  agents: Array<{ id: string; name: string; type: string }>;
}

const metricMeta: Array<{ key: keyof EvoMetricShape; label: string; fmt: (v: number) => string; better: "up" | "down" }> = [
  { key: "taskCount", label: "任务量", fmt: (v) => String(v), better: "up" },
  { key: "successRate", label: "成功率", fmt: (v) => `${v}%`, better: "up" },
  { key: "journalCount7d", label: "7日日志", fmt: (v) => String(v), better: "up" },
  { key: "memoryCount", label: "记忆量", fmt: (v) => String(v), better: "up" },
  { key: "dataSufficiency", label: "数据充分度", fmt: (v) => `${Math.round(v * 100)}%`, better: "up" },
  { key: "relevance", label: "相关性", fmt: (v) => `${Math.round(v * 100)}%`, better: "up" },
  { key: "insightLength", label: "洞见长度", fmt: (v) => String(v), better: "up" },
  { key: "latencyMs", label: "管道耗时", fmt: (v) => `${v}ms`, better: "down" },
];

export function EvolutionClient({ initialData, agents }: EvolutionClientProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string>(agents[0]?.id ?? "");
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<{
    stages: string[];
    before: EvoMetricShape | null;
    after: EvoMetricShape | null;
    skipped?: boolean;
    reason?: string;
  } | null>(null);
  const [traceFor, setTraceFor] = useState<{ record: EvolutionRecord; trace: unknown } | null>(null);

  // 成功率趋势（按月，真实数据）
  const trendMap = new Map<string, { total: number; count: number }>();
  for (const r of initialData) {
    if (!r.startedAt) continue;
    const month = r.startedAt.slice(0, 7);
    const entry = trendMap.get(month) ?? { total: 0, count: 0 };
    if (r.status === "success") entry.total += 1;
    entry.count += 1;
    trendMap.set(month, entry);
  }
  const sortedMonths = [...trendMap.keys()].sort();
  const evolutionTrend = sortedMonths.map((m) => {
    const e = trendMap.get(m)!;
    return e.count > 0 ? Math.round((e.total / e.count) * 100) : 0;
  });
  const evolutionTrendLabels = sortedMonths.map((m) => `${parseInt(m.split("-")[1])}月`);

  async function runEvolution() {
    if (!agentId) {
      toast.error("请先选择 Agent");
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/evolution/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "进化执行失败");
      const data = json.data;
      if (data.skipped) {
        toast.info(`已跳过：${data.reason === "lock_held" ? "该 Agent 正在进化中（分布式锁）" : data.reason}`);
      } else {
        setLastRun({
          stages: data.stages ?? [],
          before: data.before ?? null,
          after: data.after ?? null,
        });
        toast.success(`进化完成：${(data.stages ?? []).join(" → ")}`);
      }
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function openTrace(record: EvolutionRecord) {
    const res = await fetch(`/api/evolution/${record.id}`);
    if (!res.ok) return;
    const json = await res.json();
    const id = json.data?.id;
    const traceRes = await fetch(`/api/evolution/${id}/trace`);
    const traceJson = traceRes.ok ? await traceRes.json() : null;
    setTraceFor({ record, trace: traceJson?.data ?? null });
  }

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="自进化系统"
        description="五阶段管道（identify→generate→test→review→reuse）· 真实指标 · Redis 分布式锁"
        actions={
          <div className="flex items-center gap-2">
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="选择 Agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => void runEvolution()} disabled={running || !agentId}>
              {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              {running ? "进化中..." : "立即进化"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Zap className="h-3 w-3" /> 总进化次数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatedNumber value={initialData.length} className="text-2xl font-bold" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-success" /> 成功率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {initialData.length > 0
                ? Math.round((initialData.filter((r) => r.status === "success").length / initialData.length) * 100)
                : 0}%
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

      {/* 最近一次进化结果：五阶段管道 + before/after */}
      {lastRun && !lastRun.skipped && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              最近一次进化管道
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {STAGES.map((s, i) => {
                const done = (lastRun.stages ?? []).includes(s);
                const cfg = stageConfig[s];
                return (
                  <div key={s} className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap",
                        done ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground opacity-60",
                      )}
                    >
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-muted" />}
                      {cfg.label}
                      <span className="text-tiny text-muted-foreground hidden md:inline">{cfg.desc}</span>
                    </div>
                    {i < STAGES.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                );
              })}
            </div>
            {(lastRun.before || lastRun.after) && (
              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] items-start">
                <div>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Before（识别阶段采集）
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {metricMeta.map((m) => {
                      const v = lastRun.before?.[m.key];
                      if (v === undefined) return null;
                      return (
                        <div key={m.key} className="rounded border p-2">
                          <p className="text-tiny text-muted-foreground">{m.label}</p>
                          <p className="text-sm font-bold">{m.fmt(v)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-primary mx-auto mt-6" />
                <div>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-success" /> After（复用后重测）
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {metricMeta.map((m) => {
                      const v = lastRun.after?.[m.key];
                      if (v === undefined) return null;
                      const bv = lastRun.before?.[m.key];
                      const delta = bv !== undefined && bv !== v ? v - bv : 0;
                      const improved = delta > 0 ? (m.better === "up") : delta < 0 ? (m.better === "down") : null;
                      return (
                        <div key={m.key} className="rounded border p-2">
                          <p className="text-tiny text-muted-foreground">{m.label}</p>
                          <p className="text-sm font-bold">
                            {m.fmt(v)}
                            {delta !== 0 && (
                              <span className={cn("ml-1 text-tiny", improved ? "text-emerald-500" : "text-destructive")}>
                                {delta > 0 ? "+" : ""}{m.fmt(Math.abs(delta))}
                              </span>
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            进化成功率趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          {evolutionTrend.length > 0 ? (
            <div className="flex items-end gap-3">
              {evolutionTrend.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-medium">{v}%</span>
                  <div
                    className="w-full rounded-t bg-primary/70"
                    style={{ height: `${Math.max(6, v)}px` }}
                    title={`${evolutionTrendLabels[i]} 成功率 ${v}%`}
                  />
                  <span className="text-tiny text-muted-foreground">{evolutionTrendLabels[i]}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">暂无进化数据，进化后此处按月展示成功率趋势</p>
          )}
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
              const isExpanded = expandedId === record.id;
              const StatusIcon = status.icon;
              const metrics = (record.metrics ?? {}) as EvoMetricShape;
              const before = (record as unknown as { beforeMetrics?: EvoMetricShape }).beforeMetrics;
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
                        <Badge variant="outline" className="text-tiny h-4">{record.agentId}</Badge>
                      </div>
                    </div>
                    {metrics.memoryCount !== undefined && (
                      <span className="text-xs text-muted-foreground hidden md:inline">
                        记忆 {before?.memoryCount ?? "-"} → {metrics.memoryCount}
                      </span>
                    )}
                    {metrics.latencyMs !== undefined && (
                      <span className="text-xs text-muted-foreground hidden md:inline">{metrics.latencyMs}ms</span>
                    )}
                    <Badge variant={status.variant} className="text-xs">
                      <StatusIcon className={cn("h-3 w-3 mr-1", record.status === "in_progress" && "animate-spin")} />
                      {status.label}
                    </Badge>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 pl-10 space-y-3">
                      <p className="text-xs text-muted-foreground">{record.description}</p>
                      {before && metrics && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {metricMeta.map((m) => {
                            const b = before[m.key];
                            const a = metrics[m.key];
                            if (b === undefined && a === undefined) return null;
                            return (
                              <div key={m.key} className="rounded border p-2">
                                <p className="text-tiny text-muted-foreground">{m.label}</p>
                                <p className="text-xs font-medium">
                                  {b !== undefined ? m.fmt(b) : "-"} → {a !== undefined ? m.fmt(a) : "-"}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <Button variant="outline" size="sm" onClick={() => void openTrace(record)}>
                        <History className="h-3.5 w-3.5 mr-1" />
                        查看 Mongo 阶段审计
                      </Button>
                      {traceFor?.record.id === record.id && !!traceFor.trace && (
                        <div className="rounded border bg-muted/30 p-3 space-y-1.5">
                          {((traceFor.trace as { stages?: Array<{ stage: string; status: string; note: string; at: string }> }).stages ?? []).map((s, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <Badge variant="outline" className={cn("border-0 shrink-0", s.status === "success" ? "text-emerald-500 bg-emerald-500/10" : "text-destructive bg-destructive/10")}>
                                {stageConfig[s.stage]?.label ?? s.stage}
                              </Badge>
                              <span className="text-muted-foreground flex-1">{s.note}</span>
                              <span className="text-tiny text-muted-foreground shrink-0">{s.at}</span>
                            </div>
                          ))}
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
                <p className="text-sm">暂无进化记录，点击右上角「立即进化」开始</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </PageTransition>
  );
}
