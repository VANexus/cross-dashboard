"use client";

import { use } from "react";
import { agents, tasks } from "@/lib/mock-data";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const statusConfig = {
  online: { label: "在线", badgeVariant: "success" as const },
  busy: { label: "忙碌", badgeVariant: "warning" as const },
  error: { label: "异常", badgeVariant: "danger" as const },
  offline: { label: "离线", badgeVariant: "secondary" as const },
};

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const agent = agents.find((a) => a.id === id);

  if (!agent) {
    notFound();
  }

  const config = statusConfig[agent.status];
  const agentTasks = tasks.filter((t) => t.assignedAgents.includes(agent.id));
  const lastHB = new Date(agent.lastHeartbeat);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/agents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
            <Badge variant={config.badgeVariant}>{config.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">ID: {agent.id}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Activity className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{agent.uptime}%</div>
            <div className="text-xs text-muted-foreground">正常运行率</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
            <div className="text-2xl font-bold">{agent.taskCount}</div>
            <div className="text-xs text-muted-foreground">累计任务</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Timer className="h-5 w-5 mx-auto mb-1 text-sky-500" />
            <div className="text-2xl font-bold">{agent.successRate}%</div>
            <div className="text-xs text-muted-foreground">任务成功率</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <div className="text-sm font-bold">{lastHB.toLocaleString("zh-CN")}</div>
            <div className="text-xs text-muted-foreground">最后心跳</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">基本信息</TabsTrigger>
          <TabsTrigger value="tasks">关联任务</TabsTrigger>
        </TabsList>
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Agent 描述</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{agent.description}</p>

              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-semibold">能力指标</h4>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>正常运行率</span>
                      <span>{agent.uptime}%</span>
                    </div>
                    <Progress value={agent.uptime} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>任务成功率</span>
                      <span>{agent.successRate}%</span>
                    </div>
                    <Progress value={agent.successRate} className="h-2" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tasks">
          <div className="space-y-3">
            {agentTasks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  暂无关联任务
                </CardContent>
              </Card>
            ) : (
              agentTasks.map((task) => (
                <Link key={task.id} href={`/tasks/${task.id}`}>
                  <Card className="hover:border-primary/30 transition-all cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold">{task.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                      </div>
                      <Badge variant={task.status === "completed" ? "success" : task.status === "running" ? "warning" : task.status === "failed" ? "danger" : "secondary"}>
                        {task.status === "completed" ? "已完成" : task.status === "running" ? "运行中" : task.status === "failed" ? "失败" : "待处理"}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
