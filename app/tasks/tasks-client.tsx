"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, LayoutGroup } from "framer-motion";
import { z } from "zod";
import { PageTransition } from "@/components/ui/page-transition";
import { StatusDot } from "@/components/ui/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgentPage } from "@/lib/agent/page-context";
import type { UIActionDef } from "@/lib/agent/ui-actions";
import {
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  LayoutGrid,
  List,
  Columns3,
  Bot,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { updateTask } from "@/hooks/use-tasks";
import type { Task, Agent, TaskStatus } from "@/lib/types";

const statusConfig: Record<import("@/lib/types").TaskStatus, { label: string; icon: React.ComponentType<{ className?: string }>; variant: "success" | "secondary" | "danger" | "warning" }> = {
  completed: { label: "已完成", icon: CheckCircle2, variant: "success" },
  running: { label: "运行中", icon: Loader2, variant: "secondary" },
  pending: { label: "等待中", icon: Clock, variant: "secondary" },
  failed: { label: "失败", icon: AlertTriangle, variant: "danger" },
  cancelled: { label: "已取消", icon: Clock, variant: "warning" },
};

const priorityConfig: Record<string, { label: string; variant: "danger" | "warning" | "secondary" }> = {
  high: { label: "高", variant: "danger" },
  medium: { label: "中", variant: "warning" },
  low: { label: "低", variant: "secondary" },
  critical: { label: "紧急", variant: "danger" },
};

interface TasksClientProps {
  initialTasks: Task[];
  agents: Agent[];
}

const filterTasksSchema = z.object({
  status: z.enum(["all", "pending", "running", "completed", "failed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  keyword: z.string().optional(),
});

export function TasksClient({ initialTasks, agents }: TasksClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [view, setView] = useState<"list" | "grid" | "board">("list");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  const agentMap = useMemo(() => {
    const m: Record<string, Agent> = {};
    agents.forEach((a) => { m[a.id] = a; });
    return m;
  }, [agents]);

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const runningCount = tasks.filter((t) => t.status === "running").length;
  const failedCount = tasks.filter((t) => t.status === "failed").length;

  // 「UI 即工具」：筛选/清空/跳转详情注册为 Agent 可调用的页面动作（写入上方现有筛选 state）
  const agentActions: UIActionDef[] = [
    {
      id: "filterTasks",
      description:
        "筛选任务列表：按状态（all/pending/running/completed/failed/cancelled）、优先级（all/low/medium/high/critical）、关键词（标题/描述模糊匹配）",
      schema: filterTasksSchema,
      execute: (p) => {
        const { status, priority, keyword } = filterTasksSchema.parse(p);
        const nextStatus = status ?? statusFilter;
        const nextPriority = priority ?? priorityFilter;
        const nextKeyword = keyword ?? search;
        setStatusFilter(nextStatus);
        setPriorityFilter(nextPriority);
        setSearch(nextKeyword);
        const kw = nextKeyword.toLowerCase();
        const matched = tasks.filter(
          (t) =>
            (nextStatus === "all" || t.status === nextStatus) &&
            (nextPriority === "all" || t.priority === nextPriority) &&
            (t.title.toLowerCase().includes(kw) || t.description.toLowerCase().includes(kw)),
        );
        return (
          `已筛选出 ${matched.length} 个任务` +
          (matched.length ? `，如：${matched.slice(0, 3).map((t) => t.title).join("、")}` : "")
        );
      },
    },
    {
      id: "clearFilters",
      description: "清除任务列表的所有筛选条件（状态/优先级/关键词）",
      schema: z.object({}),
      execute: () => {
        setSearch("");
        setStatusFilter("all");
        setPriorityFilter("all");
        return `已清除筛选，显示全部 ${tasks.length} 个任务`;
      },
    },
    {
      id: "navigateToTask",
      description: "跳转到指定任务的详情页（可传任务 id 或标题关键词）",
      schema: z.object({ id: z.string().min(1).describe("任务 id 或标题关键词") }),
      execute: (p) => {
        const key = String(p.id);
        const task =
          tasks.find((t) => t.id === key) ??
          tasks.find((t) => t.title.toLowerCase().includes(key.toLowerCase()));
        if (!task) return `未找到任务：${key}`;
        router.push(`/tasks/${task.id}`);
        return `已跳转到任务「${task.title}」详情`;
      },
    },
  ];

  useAgentPage({
    title: "任务中心",
    snapshot: () => {
      const c = (st: TaskStatus) => tasks.filter((t) => t.status === st).length;
      return (
        `今日任务 ${tasks.length} 个：running ${c("running")} / completed ${c("completed")} / ` +
        `failed ${c("failed")} / pending ${c("pending")} · 当前筛选 status=${statusFilter} ` +
        `priority=${priorityFilter} keyword="${search}" · 可见 ${filtered.length} 条` +
        (filtered.length ? `（代表：${filtered.slice(0, 5).map((t) => t.title).join("、")}）` : "")
      );
    },
    state: () => ({
      search,
      statusFilter,
      priorityFilter,
      view,
      total: tasks.length,
      visible: filtered.length,
    }),
    actions: agentActions,
  });

  const handleMove = (taskId: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    updateTask(taskId, { status }).catch(() => {});
  };

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="任务管理"
        description="查看和管理所有工作流任务的执行状态"
      />

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索任务..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            全部 ({initialTasks.length})
          </Button>
          <Button
            variant={statusFilter === "running" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("running")}
          >
            运行中 ({runningCount})
          </Button>
          <Button
            variant={statusFilter === "completed" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("completed")}
          >
            已完成 ({completedCount})
          </Button>
          <Button
            variant={statusFilter === "failed" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("failed")}
          >
            失败 ({failedCount})
          </Button>
        </div>
        <div className="flex items-center border rounded-md">
          <Button
            variant={view === "list" ? "default" : "ghost"}
            size="sm"
            className="h-8 rounded-r-none"
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "grid" ? "default" : "ghost"}
            size="sm"
            className="h-8 rounded-l-none"
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "board" ? "default" : "ghost"}
            size="sm"
            className="h-8 rounded-l-none border-l"
            onClick={() => setView("board")}
          >
            <Columns3 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {view === "list" ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map((task) => {
                const agent = agentMap[task.assignedAgents[0]];
                return (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <StatusDot
                      status={task.status === "running" ? "success" : task.status === "completed" ? "idle" : task.status === "failed" ? "danger" : "warning"}
                      pulse={task.status === "running"}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                    </div>
                    <Badge variant={priorityConfig[task.priority]?.variant || "secondary"} className="text-xs">
                      {priorityConfig[task.priority]?.label || task.priority}
                    </Badge>
                    {agent && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        {agent.name}
                      </span>
                    )}
                    <Badge variant={statusConfig[task.status]?.variant || "outline"} className="text-xs">
                      {statusConfig[task.status]?.label || task.status}
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
                  </Link>
                );
              })}
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search className="h-8 w-8 mb-2" />
                  <p className="text-sm">未找到匹配的任务</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : view === "grid" ? (
        <div className="grid gap-4 grid-cols-2">
          {filtered.map((task) => {
            const agent = agentMap[task.assignedAgents[0]];
            const config = statusConfig[task.status];
            return (
              <Link key={task.id} href={`/tasks/${task.id}`}>
                <Card className="cursor-pointer hover:border-primary/50 transition-all h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <StatusDot
                          status={task.status === "running" ? "success" : task.status === "completed" ? "idle" : task.status === "failed" ? "danger" : "warning"}
                          pulse={task.status === "running"}
                        />
                        <CardTitle className="text-sm">{task.title}</CardTitle>
                      </div>
                      <Badge variant={config?.variant || "outline"} className="text-xs">
                        {config?.label || task.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {agent && (
                        <span className="flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          {agent.name}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <LayoutGroup>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {(Object.keys(statusConfig) as TaskStatus[]).map((status) => {
              const config = statusConfig[status];
              const columnTasks = filtered.filter((t) => t.status === status);
              return (
                <div
                  key={status}
                  className="flex w-[248px] shrink-0 flex-col gap-3 rounded-2xl border border-border/70 bg-muted/25 p-3"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingId) handleMove(draggingId, status);
                    setDraggingId(null);
                  }}
                >
                  <div className="flex items-center gap-2 px-1.5">
                    <config.icon className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold text-muted-foreground">{config.label}</span>
                    <span className="metric-value ml-auto text-caption text-muted-foreground">{columnTasks.length}</span>
                  </div>
                  {columnTasks.map((task) => {
                    const agent = agentMap[task.assignedAgents[0]];
                    return (
                      <motion.div
                        key={task.id}
                        layout
                        layoutId={task.id}
                        draggable
                        onDragStart={() => setDraggingId(task.id)}
                        onDragEnd={() => setDraggingId(null)}
                        className={cn(
                          "cursor-grab rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/40 active:cursor-grabbing",
                          draggingId === task.id && "opacity-50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug">{task.title}</p>
                          <Badge variant="outline" className="shrink-0 border-0 text-tiny">
                            {priorityConfig[task.priority]?.label || task.priority}
                          </Badge>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
                        {agent && (
                          <div className="mt-2.5 flex items-center gap-1.5 border-t border-border/70 pt-2 text-xs text-muted-foreground">
                            <Bot className="h-3 w-3" />
                            {agent.name}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                  {columnTasks.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border/70 py-8 text-center text-xs text-muted-foreground/60">
                      拖拽任务到这里
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </LayoutGroup>
      )}
    </PageTransition>
  );
}
