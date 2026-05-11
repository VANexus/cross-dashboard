"use client";

import dynamic from "next/dynamic";
import { PageTransition } from "@/components/ui/page-transition";
import { StatusDot } from "@/components/ui/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Clock,
  Activity,
  Settings,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Bot,
  BarChart3,
  ListTodo,
} from "lucide-react";
import Link from "next/link";
import type { Agent, Task } from "@/lib/types";

const AnimatedNumber = dynamic(
  () => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })),
  { ssr: false }
);

const statusConfig: Record<import("@/lib/types").AgentStatus, { label: string; color: string; bg: string; dot: "success" | "idle" | "warning" | "danger" }> = {
  online: { label: "在线", color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "success" },
  busy: { label: "忙碌", color: "text-amber-500", bg: "bg-amber-500/10", dot: "warning" },
  error: { label: "异常", color: "text-red-500", bg: "bg-red-500/10", dot: "danger" },
  offline: { label: "离线", color: "text-muted-foreground", bg: "bg-muted", dot: "idle" },
};

interface AgentDetailClientProps {
  agent: Agent;
  tasks: Task[];
}

export function AgentDetailClient({ agent, tasks }: AgentDetailClientProps) {
  const config = statusConfig[agent.status];

  return (
    <PageTransition className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/agents">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {agent.name}
            <StatusDot status={config.dot} pulse={agent.status === "online"} />
          </h1>
          <p className="text-muted-foreground text-sm">{agent.type}</p>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              运行状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className={`${config.color} ${config.bg} border-0`}>
              {config.label}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              最后活跃: {agent.lastHeartbeat}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-primary" />
              任务统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <AnimatedNumber value={tasks.length} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {tasks.filter((t) => t.status === "running").length} 运行中
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              完成率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {tasks.length > 0
                ? Math.round((tasks.filter((t) => t.status === "completed").length / tasks.length) * 100)
                : 0}%
            </div>
            <Progress
              value={tasks.length > 0 ? (tasks.filter((t) => t.status === "completed").length / tasks.length) * 100 : 0}
              className="h-1.5 mt-2"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Agent 详情
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">描述</p>
            <p className="text-sm">{agent.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">类型</p>
              <Badge variant="secondary">{agent.type}</Badge>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">反馈权限</p>
              <Badge variant="secondary">L{agent.reflexLevel}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            关联任务
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">暂无关联任务</p>
          ) : (
            <div className="divide-y">
              {tasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <StatusDot
                    status={
                      task.status === "running" ? "success" :
                      task.status === "completed" ? "idle" :
                      task.status === "failed" ? "danger" : "warning"
                    }
                    pulse={task.status === "running"}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.priority}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      task.status === "completed" ? "text-emerald-500 bg-emerald-500/10 border-0" :
                      task.status === "running" ? "text-blue-500 bg-blue-500/10 border-0" :
                      task.status === "failed" ? "text-red-500 bg-red-500/10 border-0" :
                      "text-muted-foreground bg-muted border-0"
                    }
                  >
                    {task.status === "completed" ? "已完成" :
                     task.status === "running" ? "运行中" :
                     task.status === "failed" ? "失败" : task.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageTransition>
  );
}
