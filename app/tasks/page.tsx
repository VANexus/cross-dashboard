"use client";

import { useState, useMemo } from "react";
import { tasks, agents } from "@/lib/mock-data";
import type { Task, TaskStep } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";
import {
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  List,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Zap,
  Filter,
  LayoutList,
  AlignJustify,
} from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "danger" | "secondary" | "default"; dot: "success" | "warning" | "danger" | "idle" | "info" }> = {
  pending: { label: "待处理", variant: "secondary", dot: "idle" },
  running: { label: "运行中", variant: "warning", dot: "warning" },
  completed: { label: "已完成", variant: "success", dot: "success" },
  failed: { label: "失败", variant: "danger", dot: "danger" },
  cancelled: { label: "已取消", variant: "secondary", dot: "idle" },
};

const priorityConfig: Record<string, { label: string; variant: "default" | "secondary" | "warning" | "danger" }> = {
  low: { label: "低", variant: "secondary" },
  medium: { label: "中", variant: "default" },
  high: { label: "高", variant: "warning" },
  critical: { label: "紧急", variant: "danger" },
};

const workflowRules = [
  { keywords: ["选品", "产品分析", "BSR", "潜力"], label: "选品工作流", color: "var(--wf-product)", bg: "bg-blue-500/10" },
  { keywords: ["广告", "ACOS", "PPC", "出价", "关键词优化"], label: "AI 广告", color: "var(--wf-ad)", bg: "bg-orange-500/10" },
  { keywords: ["Listing", "上架", "文案", "图片"], label: "AI 上架", color: "var(--wf-listing)", bg: "bg-emerald-500/10" },
  { keywords: ["库存", "库销", "补货", "滞销"], label: "库销比", color: "var(--wf-inventory)", bg: "bg-cyan-500/10" },
  { keywords: ["竞品", "竞争"], label: "竞品广告", color: "var(--wf-competitor)", bg: "bg-pink-500/10" },
  { keywords: ["合规", "专利", "侵权", "认证"], label: "风控", color: "#ef4444", bg: "bg-red-500/10" },
  { keywords: ["图片", "作图", "主图", "视频"], label: "AI 作图", color: "var(--wf-imaging)", bg: "bg-purple-500/10" },
];

function matchWorkflow(task: Task) {
  const text = `${task.title} ${task.description}`.toLowerCase();
  for (const rule of workflowRules) {
    if (rule.keywords.some((k) => text.includes(k.toLowerCase()))) {
      return rule;
    }
  }
  return null;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function getAgentName(id: string) {
  return agents.find((a) => a.id === id)?.name || id;
}

export default function TasksPage() {
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch =
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase());
      const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchSearch && matchPriority;
    });
  }, [search, priorityFilter]);

  const runningCount = tasks.filter((t) => t.status === "running").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const failedCount = tasks.filter((t) => t.status === "failed").length;

  const runningTasks = filtered.filter((t) => t.status === "running");
  const completedTasks = filtered.filter((t) => t.status === "completed");
  const pendingTasks = filtered.filter((t) => t.status === "pending");

  const toggleExpand = (taskId: string) => {
    setExpandedTask((prev) => (prev === taskId ? null : taskId));
  };

  const renderStepTimeline = (steps: TaskStep[]) => (
    <div className="mt-3 ml-2 pl-4 border-l-2 border-border/50 space-y-2.5">
      {steps.map((step, i) => {
        const sc = statusConfig[step.status];
        const isLast = i === steps.length - 1;
        return (
          <div key={step.id} className="relative flex items-start gap-3">
            <div className="absolute -left-[21px] top-1.5">
              <StatusDot status={sc.dot} size="sm" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-medium", step.status === "running" && "text-amber-500")}>
                  {step.name}
                </span>
                <Badge variant={sc.variant} className="text-[9px] px-1 py-0">{sc.label}</Badge>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                {step.startedAt && (
                  <span>{formatTime(step.startedAt)}{step.completedAt ? ` - ${formatTime(step.completedAt)}` : " - ..."}</span>
                )}
                {!step.startedAt && <span>待执行</span>}
                <span>{getAgentName(step.agentId)}</span>
              </div>
              {step.output && (
                <p className="text-[10px] text-emerald-500/80 mt-0.5 truncate">{step.output}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderTaskCard = (task: Task) => {
    const s = statusConfig[task.status];
    const p = priorityConfig[task.priority];
    const wf = matchWorkflow(task);
    const completedSteps = task.steps.filter((st) => st.status === "completed").length;
    const isExpanded = expandedTask === task.id;

    return (
      <Card
        key={task.id}
        className={cn(
          "mb-3 transition-all cursor-pointer group",
          task.status === "running" ? "border-amber-500/30" : "hover:border-primary/30"
        )}
        onClick={() => toggleExpand(task.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <StatusDot status={s.dot} size="sm" />
                <h3 className="text-sm font-semibold truncate">{task.title}</h3>
                <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>
                <Badge variant={p.variant} className="text-[10px]">{p.label}</Badge>
                {wf && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: `color-mix(in srgb, ${wf.color} 15%, transparent)`, color: wf.color }}
                  >
                    <Zap className="h-2.5 w-2.5" />
                    {wf.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDateTime(task.createdAt)}
                </span>
                <span>Agent: {task.assignedAgents.map(getAgentName).join(", ")}</span>
                <span className="flex items-center gap-1">
                  步骤: {completedSteps}/{task.steps.length}
                  <span className="w-12 h-1 rounded-full bg-muted overflow-hidden">
                    <span
                      className="block h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(completedSteps / task.steps.length) * 100}%` }}
                    />
                  </span>
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
              {task.output && (
                <span className="text-[10px] text-emerald-500 max-w-[160px] truncate">{task.output}</span>
              )}
            </div>
          </div>
          {isExpanded && renderStepTimeline(task.steps)}
        </CardContent>
      </Card>
    );
  };

  const renderTimelineView = () => {
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return (
      <div className="relative pl-6">
        <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border" />
        {sorted.map((task) => {
          const s = statusConfig[task.status];
          const wf = matchWorkflow(task);
          return (
            <div key={task.id} className="relative mb-6">
              <div className="absolute -left-6 top-3 w-[22px] h-[22px] rounded-full flex items-center justify-center z-10"
                style={{ backgroundColor: task.status === "running" ? "var(--amber)" : task.status === "completed" ? "var(--emerald)" : "var(--muted)" }}
              >
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
              {task.status === "running" && (
                <div className="absolute -left-6 top-3 w-[22px] h-[22px] rounded-full animate-ping opacity-30"
                  style={{ backgroundColor: "var(--amber)" }}
                />
              )}
              <Card
                className={cn(
                  "ml-2 transition-all cursor-pointer",
                  task.status === "running" ? "border-amber-500/30" : "hover:border-primary/30"
                )}
                onClick={() => toggleExpand(task.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1 text-[10px] text-muted-foreground">
                    <span>{formatDateTime(task.createdAt)}</span>
                    <Badge variant={s.variant} className="text-[9px]">{s.label}</Badge>
                    {wf && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px]"
                        style={{ backgroundColor: `color-mix(in srgb, ${wf.color} 15%, transparent)`, color: wf.color }}
                      >
                        {wf.label}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold mb-1">{task.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>Agent: {task.assignedAgents.map(getAgentName).join(", ")}</span>
                    <span>
                      步骤: {task.steps.filter((st) => st.status === "completed").length}/{task.steps.length}
                    </span>
                  </div>
                  {expandedTask === task.id && renderStepTimeline(task.steps)}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    );
  };

  const metrics = [
    { label: "总任务", value: tasks.length, color: "text-foreground", icon: LayoutList },
    { label: "运行中", value: runningCount, color: "text-amber-500", icon: Loader2 },
    { label: "已完成", value: completedCount, color: "text-emerald-500", icon: CheckCircle2 },
    { label: "失败", value: failedCount, color: "text-red-500", icon: XCircle },
  ];

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">任务中心</h1>
          <p className="text-sm text-muted-foreground">查看和管理所有智能任务</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <Card key={m.label} className={cn(m.label === "运行中" && runningCount > 0 && "border-amber-500/30")}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn("rounded-lg p-2", m.label === "运行中" ? "bg-amber-500/10" : m.label === "已完成" ? "bg-emerald-500/10" : m.label === "失败" ? "bg-red-500/10" : "bg-muted")}>
                    <Icon className={cn("h-4 w-4", m.color, m.label === "运行中" && runningCount > 0 && "animate-spin")} />
                  </div>
                  <div>
                    <div className={cn("text-2xl font-bold tabular-nums", m.color)}>
                      <AnimatedNumber value={m.value} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{m.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索任务..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              className="text-xs bg-muted border border-border rounded-md px-2 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-primary/30"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">全部优先级</option>
              <option value="critical">紧急</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors",
                viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5" />
              列表
            </button>
            <button
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors",
                viewMode === "timeline" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewMode("timeline")}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              时间线
            </button>
          </div>
        </div>

        {viewMode === "list" ? (
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">全部 ({filtered.length})</TabsTrigger>
              <TabsTrigger value="running">
                运行中 ({runningTasks.length})
              </TabsTrigger>
              <TabsTrigger value="completed">已完成 ({completedTasks.length})</TabsTrigger>
              <TabsTrigger value="pending">待处理 ({pendingTasks.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-4">
              {filtered.length === 0 ? (
                <EmptyState />
              ) : (
                filtered.map(renderTaskCard)
              )}
            </TabsContent>
            <TabsContent value="running" className="mt-4">
              {runningTasks.length === 0 ? (
                <EmptyState text="暂无运行中的任务" />
              ) : (
                runningTasks.map(renderTaskCard)
              )}
            </TabsContent>
            <TabsContent value="completed" className="mt-4">
              {completedTasks.length === 0 ? (
                <EmptyState text="暂无已完成任务" />
              ) : (
                completedTasks.map(renderTaskCard)
              )}
            </TabsContent>
            <TabsContent value="pending" className="mt-4">
              {pendingTasks.length === 0 ? (
                <EmptyState text="暂无待处理任务" />
              ) : (
                pendingTasks.map(renderTaskCard)
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div>
            {filtered.length === 0 ? (
              <EmptyState />
            ) : (
              renderTimelineView()
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function EmptyState({ text = "未找到匹配的任务" }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <AlignJustify className="h-10 w-10 mb-3 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
