"use client";

import dynamic from "next/dynamic";
import { PageTransition } from "@/components/ui/page-transition";
import { StatusDot } from "@/components/ui/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Bot,
  Workflow,
  Play,
  Pause,
  RotateCw,
} from "lucide-react";
import Link from "next/link";
import type { Task, Agent } from "@/lib/types";

const AnimatedNumber = dynamic(
  () => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })),
  { ssr: false }
);

const statusConfig: Record<import("@/lib/types").TaskStatus, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  completed: { label: "已完成", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  running: { label: "运行中", icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/10" },
  pending: { label: "等待中", icon: Clock, color: "text-muted-foreground", bg: "bg-muted" },
  failed: { label: "失败", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
  cancelled: { label: "已取消", icon: Pause, color: "text-amber-500", bg: "bg-amber-500/10" },
};

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "高优先级", color: "text-red-500", bg: "bg-red-500/10" },
  medium: { label: "中优先级", color: "text-amber-500", bg: "bg-amber-500/10" },
  low: { label: "低优先级", color: "text-blue-500", bg: "bg-blue-500/10" },
  critical: { label: "紧急", color: "text-red-500", bg: "bg-red-500/10" },
};

const stepIcons: Record<string, React.ReactNode> = {
  init: <Play className="h-4 w-4" />,
  fetch: <RotateCw className="h-4 w-4" />,
  analyze: <Bot className="h-4 w-4" />,
  generate: <Workflow className="h-4 w-4" />,
  complete: <CheckCircle2 className="h-4 w-4" />,
};

const stepColors: Record<string, string> = {
  completed: "bg-emerald-500 text-white",
  running: "bg-blue-500 text-white animate-pulse",
  pending: "bg-muted text-muted-foreground",
  failed: "bg-red-500 text-white",
};

const statusLabels: Record<string, string> = {
  completed: "已完成",
  running: "运行中",
  pending: "等待中",
  failed: "失败",
};

interface TaskDetailClientProps {
  task: Task;
  agent: Agent | undefined;
}

export function TaskDetailClient({ task, agent }: TaskDetailClientProps) {
  const config = statusConfig[task.status];
  const pConfig = priorityConfig[task.priority];
  const completedSteps = task.steps?.filter((s) => s.status === "completed").length || 0;
  const totalSteps = task.steps?.length || 0;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <PageTransition className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/tasks">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {task.title}
            <StatusDot
              status={task.status === "running" ? "success" : task.status === "completed" ? "idle" : task.status === "failed" ? "danger" : "warning"}
              pulse={task.status === "running"}
            />
          </h1>
          <p className="text-muted-foreground text-sm">{task.description}</p>
        </div>
        <div className="flex gap-2">
          {task.status === "running" && (
            <Button variant="outline" size="sm">
              <Pause className="h-4 w-4 mr-1" />
              暂停
            </Button>
          )}
          {task.status === "failed" && (
            <Button variant="outline" size="sm">
              <RotateCw className="h-4 w-4 mr-1" />
              重试
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">状态</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className={cn(config?.color, config?.bg, "border-0")}>
              {config?.label || task.status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">优先级</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className={cn(pConfig?.color, pConfig?.bg, "border-0")}>
              {pConfig?.label || task.priority}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">步骤数</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-sm font-medium">{completedSteps}/{totalSteps}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">进度</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AnimatedNumber value={Math.round(progress)} className="text-lg font-bold" />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <Progress value={progress} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
      </div>

      {agent && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              执行 Agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/agents/${agent.id}`} className="flex items-center gap-3 hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{agent.name}</p>
                <p className="text-xs text-muted-foreground">{agent.type}</p>
              </div>
              <StatusDot status={agent.status === "online" ? "success" : agent.status === "busy" ? "warning" : agent.status === "error" ? "danger" : "idle"} pulse={agent.status === "online"} />
            </Link>
          </CardContent>
        </Card>
      )}

      {task.steps && task.steps.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Workflow className="h-4 w-4 text-primary" />
              执行步骤
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-4">
                {task.steps.map((step, i) => (
                  <div key={step.id} className="relative flex items-start gap-4 pl-2">
                    <div className={cn("relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium", stepColors[step.status])}>
                      {stepIcons[step.id] || <span>{i + 1}</span>}
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-sm font-medium">{step.name}</p>
                      {step.output && <p className="text-xs text-muted-foreground mt-0.5">{step.output}</p>}
                      {step.startedAt && (
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {step.startedAt}
                          {step.completedAt && ` → ${step.completedAt}`}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className={cn(
                      step.status === "completed" ? "text-emerald-500 bg-emerald-500/10 border-0" :
                      step.status === "running" ? "text-blue-500 bg-blue-500/10 border-0" :
                      step.status === "failed" ? "text-red-500 bg-red-500/10 border-0" :
                      "text-muted-foreground bg-muted border-0",
                      "text-xs"
                    )}>
                      {statusLabels[step.status] || step.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </PageTransition>
  );
}
