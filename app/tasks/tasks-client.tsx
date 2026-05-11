"use client";

import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { StatusDot } from "@/components/ui/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Filter,
  LayoutGrid,
  List,
  ArrowUpDown,
  Bot,
  Workflow,
  ArrowRight,
  BarChart3,
  Eye,
} from "lucide-react";
import Link from "next/link";
import type { Task, Agent } from "@/lib/types";

const AnimatedNumber = dynamic(
  () => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })),
  { ssr: false }
);

const statusConfig: Record<import("@/lib/types").TaskStatus, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  completed: { label: "已完成", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", variant: "default" },
  running: { label: "运行中", icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/10", variant: "secondary" },
  pending: { label: "等待中", icon: Clock, color: "text-muted-foreground", bg: "bg-muted", variant: "outline" },
  failed: { label: "失败", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10", variant: "destructive" },
  cancelled: { label: "已取消", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", variant: "outline" },
};

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "高", color: "text-red-500", bg: "bg-red-500/10" },
  medium: { label: "中", color: "text-amber-500", bg: "bg-amber-500/10" },
  low: { label: "低", color: "text-blue-500", bg: "bg-blue-500/10" },
  critical: { label: "紧急", color: "text-red-500", bg: "bg-red-500/10" },
};

interface TasksClientProps {
  initialTasks: Task[];
  agents: Agent[];
}

export function TasksClient({ initialTasks, agents }: TasksClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [view, setView] = useState<"list" | "grid">("list");

  const filtered = useMemo(() => {
    return initialTasks.filter((t) => {
      const matchSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [initialTasks, search, statusFilter]);

  const agentMap = useMemo(() => {
    const m: Record<string, Agent> = {};
    agents.forEach((a) => { m[a.id] = a; });
    return m;
  }, [agents]);

  const completedCount = initialTasks.filter((t) => t.status === "completed").length;
  const runningCount = initialTasks.filter((t) => t.status === "running").length;
  const pendingCount = initialTasks.filter((t) => t.status === "pending").length;
  const failedCount = initialTasks.filter((t) => t.status === "failed").length;

  return (
    <PageTransition className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">任务管理</h1>
          <p className="text-muted-foreground text-sm">
            查看和管理所有工作流任务的执行状态
          </p>
        </div>
      </div>

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
                    <Badge variant="outline" className={cn("text-xs", priorityConfig[task.priority]?.color, priorityConfig[task.priority]?.bg, "border-0")}>
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
      ) : (
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
      )}
    </PageTransition>
  );
}
