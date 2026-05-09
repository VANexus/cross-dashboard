"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { systemMetrics } from "@/lib/mock-data";
import { Cpu, HardDrive, MemoryStick, Timer, Activity, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const metrics = [
  {
    label: "CPU 使用率",
    value: systemMetrics.cpu,
    icon: Cpu,
    color: systemMetrics.cpu > 80 ? "text-red-500" : systemMetrics.cpu > 60 ? "text-amber-500" : "text-emerald-500",
    barColor: systemMetrics.cpu > 80 ? "bg-red-500" : systemMetrics.cpu > 60 ? "bg-amber-500" : "bg-emerald-500",
  },
  {
    label: "内存使用",
    value: systemMetrics.memory,
    icon: MemoryStick,
    color: systemMetrics.memory > 80 ? "text-red-500" : systemMetrics.memory > 60 ? "text-amber-500" : "text-emerald-500",
    barColor: systemMetrics.memory > 80 ? "bg-red-500" : systemMetrics.memory > 60 ? "bg-amber-500" : "bg-emerald-500",
  },
  {
    label: "磁盘使用",
    value: systemMetrics.disk,
    icon: HardDrive,
    color: systemMetrics.disk > 80 ? "text-red-500" : systemMetrics.disk > 60 ? "text-amber-500" : "text-emerald-500",
    barColor: systemMetrics.disk > 80 ? "bg-red-500" : systemMetrics.disk > 60 ? "bg-amber-500" : "bg-emerald-500",
  },
];

export function SystemMetricsPanel() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">系统性能</CardTitle>
        <p className="text-xs text-muted-foreground">服务器资源使用情况</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", metric.color)} />
                  <span className="text-xs font-medium">{metric.label}</span>
                </div>
                <span className="text-xs font-semibold">{metric.value}%</span>
              </div>
              <Progress value={metric.value} className="h-1.5 [&>div]:bg-none" style={{ "--tw-bg-opacity": 1 } as React.CSSProperties}>
                <div className={cn("h-full rounded-full transition-all", metric.barColor)} style={{ width: `${metric.value}%` }} />
              </Progress>
            </div>
          );
        })}

        <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Timer className="h-3 w-3" />
              <span className="text-[10px]">响应时间</span>
            </div>
            <div className="text-sm font-bold">{systemMetrics.responseTime}ms</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Activity className="h-3 w-3" />
              <span className="text-[10px]">吞吐量</span>
            </div>
            <div className="text-sm font-bold">{systemMetrics.throughput}/s</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Users className="h-3 w-3" />
              <span className="text-[10px]">活跃连接</span>
            </div>
            <div className="text-sm font-bold">{systemMetrics.activeConnections}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
