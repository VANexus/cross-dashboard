"use client";

import { use } from "react";
import { tasks, agents } from "@/lib/mock-data";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Clock, Circle, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const stepIcons = {
  pending: Circle,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: XCircle,
};

const stepColors = {
  pending: "text-muted-foreground",
  running: "text-amber-500 animate-spin",
  completed: "text-emerald-500",
  failed: "text-red-500",
  cancelled: "text-muted-foreground",
};

const statusLabels: Record<string, { label: string; variant: "success" | "warning" | "danger" | "secondary" }> = {
  pending: { label: "待处理", variant: "secondary" },
  running: { label: "运行中", variant: "warning" },
  completed: { label: "已完成", variant: "success" },
  failed: { label: "失败", variant: "danger" },
  cancelled: { label: "已取消", variant: "secondary" },
};

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const task = tasks.find((t) => t.id === id);

  if (!task) notFound();

  const s = statusLabels[task.status];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/tasks">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{task.title}</h1>
            <Badge variant={s.variant}>{s.label}</Badge>
            <Badge variant={task.priority === "critical" ? "danger" : task.priority === "high" ? "warning" : "default"}>
              {task.priority === "critical" ? "紧急" : task.priority === "high" ? "高优先" : task.priority === "medium" ? "中优先" : "低优先"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">创建时间</div>
            <div className="text-sm font-medium">{new Date(task.createdAt).toLocaleString("zh-CN")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">最后更新</div>
            <div className="text-sm font-medium">{new Date(task.updatedAt).toLocaleString("zh-CN")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">分配 Agent</div>
            <div className="text-sm font-medium">
              {task.assignedAgents.map((id) => agents.find((a) => a.id === id)?.name || id).join(", ")}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">执行步骤</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {task.steps.map((step, index) => {
              const Icon = stepIcons[step.status];
              const color = stepColors[step.status];
              return (
                <div key={step.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <Icon className={cn("h-5 w-5", color)} />
                    {index < task.steps.length - 1 && (
                      <div className={cn("w-px h-full min-h-[40px]", step.status === "completed" ? "bg-emerald-500/30" : "bg-border")} />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{step.name}</span>
                      <Badge variant={statusLabels[step.status]?.variant || "secondary"} className="text-[10px]">
                        {statusLabels[step.status]?.label || step.status}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        ({agents.find((a) => a.id === step.agentId)?.name || step.agentId})
                      </span>
                    </div>
                    {step.startedAt && (
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(step.startedAt).toLocaleString("zh-CN")}
                        {step.completedAt && ` → ${new Date(step.completedAt).toLocaleString("zh-CN")}`}
                      </div>
                    )}
                    {step.output && (
                      <p className="text-xs text-muted-foreground mt-1 rounded bg-muted/50 px-2 py-1">{step.output}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {task.output && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">任务输出</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{task.output}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
