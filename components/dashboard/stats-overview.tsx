"use client";

import { Card, CardContent } from "@/components/ui/card";
import { dashboardStats } from "@/lib/mock-data";
import { Bot, ListTodo, ShieldAlert, Activity } from "lucide-react";

const stats = [
  {
    label: "Agent 总数",
    value: dashboardStats.totalAgents,
    sub: `${dashboardStats.onlineAgents} 在线 / ${dashboardStats.busyAgents} 忙碌 / ${dashboardStats.offlineAgents} 离线`,
    icon: Bot,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
  {
    label: "任务总览",
    value: dashboardStats.totalTasks,
    sub: `${dashboardStats.runningTasks} 运行中 / ${dashboardStats.completedTasks} 已完成 / ${dashboardStats.failedTasks} 失败`,
    icon: ListTodo,
    color: "text-sky-500",
    bg: "bg-sky-500/10",
  },
  {
    label: "风险事件(24h)",
    value: dashboardStats.riskEvents24h,
    sub: `${dashboardStats.activeCircuitBreakers} 个活跃熔断器`,
    icon: ShieldAlert,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    label: "系统状态",
    value: "正常",
    sub: "所有核心服务运行正常",
    icon: Activity,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
];

export function StatsOverview() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="group hover:shadow-md transition-all hover:border-primary/20">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.sub}</p>
                </div>
                <div className={`rounded-lg p-2 ${stat.bg}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
