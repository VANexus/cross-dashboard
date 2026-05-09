"use client";

import { tasks, agents } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Clock, Search, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useState } from "react";

const statusLabels: Record<string, { label: string; variant: "success" | "warning" | "danger" | "secondary" | "default" }> = {
  pending: { label: "待处理", variant: "secondary" },
  running: { label: "运行中", variant: "warning" },
  completed: { label: "已完成", variant: "success" },
  failed: { label: "失败", variant: "danger" },
  cancelled: { label: "已取消", variant: "secondary" },
};

const priorityLabels: Record<string, { label: string; variant: "default" | "secondary" | "warning" | "danger" }> = {
  low: { label: "低", variant: "secondary" },
  medium: { label: "中", variant: "default" },
  high: { label: "高", variant: "warning" },
  critical: { label: "紧急", variant: "danger" },
};

export default function TasksPage() {
  const [search, setSearch] = useState("");

  const filtered = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  );

  const runningTasks = filtered.filter((t) => t.status === "running");
  const completedTasks = filtered.filter((t) => t.status === "completed");
  const pendingTasks = filtered.filter((t) => t.status === "pending");

  const getAgentNames = (ids: string[]) =>
    ids
      .map((id) => agents.find((a) => a.id === id)?.name || id)
      .join(", ");

  const renderTask = (task: (typeof tasks)[0]) => {
    const s = statusLabels[task.status];
    const p = priorityLabels[task.priority];
    const completedSteps = task.steps.filter((s) => s.status === "completed").length;

    return (
      <Link key={task.id} href={`/tasks/${task.id}`}>
        <Card className="mb-3 hover:border-primary/30 transition-all cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold truncate">{task.title}</h3>
                  <Badge variant={s.variant}>{s.label}</Badge>
                  <Badge variant={p.variant} className="text-[10px]">{p.label}优先</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(task.createdAt).toLocaleString("zh-CN")}
                  </span>
                  <span>Agent: {getAgentNames(task.assignedAgents)}</span>
                  <span>步骤: {completedSteps}/{task.steps.length}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                {task.output && (
                  <span className="text-[10px] text-emerald-500 max-w-[160px] truncate">{task.output}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">任务中心</h1>
          <p className="text-sm text-muted-foreground">查看和管理所有智能任务</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索任务..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">全部 ({filtered.length})</TabsTrigger>
          <TabsTrigger value="running">运行中 ({runningTasks.length})</TabsTrigger>
          <TabsTrigger value="completed">已完成 ({completedTasks.length})</TabsTrigger>
          <TabsTrigger value="pending">待处理 ({pendingTasks.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          {filtered.map(renderTask)}
        </TabsContent>
        <TabsContent value="running" className="mt-4">
          {runningTasks.map(renderTask)}
        </TabsContent>
        <TabsContent value="completed" className="mt-4">
          {completedTasks.map(renderTask)}
        </TabsContent>
        <TabsContent value="pending" className="mt-4">
          {pendingTasks.map(renderTask)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
