"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { riskEvents } from "@/lib/mock-data";
import type { RiskLevel } from "@/lib/types";
import { ShieldAlert, ShieldCheck, ShieldX, AlertTriangle, CheckCircle2, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const riskConfig: Record<RiskLevel, { label: string; description: string; color: string; bg: string; icon: typeof ShieldAlert }> = {
  safe: { label: "安全", description: "系统正常运行", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: ShieldCheck },
  level3: { label: "Ⅲ级预警", description: "日志记录 + 标记", color: "text-amber-500", bg: "bg-amber-500/10", icon: ShieldAlert },
  level2: { label: "Ⅱ级熔断", description: "暂停执行 + 自动回滚", color: "text-orange-500", bg: "bg-orange-500/10", icon: AlertTriangle },
  level1: { label: "Ⅰ级隔离", description: "终止 + 永久隔离", color: "text-red-500", bg: "bg-red-500/10", icon: ShieldX },
};

const levelStats = [
  { level: "level3" as RiskLevel, count: 2 },
  { level: "level2" as RiskLevel, count: 1 },
  { level: "level1" as RiskLevel, count: 1 },
];

export default function RiskPage() {
  const activeEvents = riskEvents.filter((e) => !e.resolved);
  const resolvedEvents = riskEvents.filter((e) => e.resolved);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">风险熔断监控</h1>
        <p className="text-sm text-muted-foreground">三级熔断机制：Ⅲ级预警 → Ⅱ级熔断 → Ⅰ级隔离</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {levelStats.map(({ level, count }) => {
          const config = riskConfig[level];
          const Icon = config.icon;
          return (
            <Card key={level} className={cn("border-l-4", level === "level1" ? "border-l-red-500" : level === "level2" ? "border-l-orange-500" : "border-l-amber-500")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("rounded-lg p-2", config.bg)}>
                    <Icon className={cn("h-5 w-5", config.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{config.label}</p>
                    <p className="text-[11px] text-muted-foreground">{config.description}</p>
                  </div>
                  <div className="ml-auto text-2xl font-bold">{count}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">活跃告警</CardTitle>
              <Badge variant="danger">{activeEvents.length} 个</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeEvents.map((event) => {
                const config = riskConfig[event.level];
                const Icon = config.icon;
                return (
                  <div key={event.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-start gap-3">
                      <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", config.color)} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{event.title}</span>
                          <Badge variant={event.level === "level1" ? "destructive" : event.level === "level2" ? "danger" : "warning"}>
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          {new Date(event.timestamp).toLocaleString("zh-CN")}
                          <span className="mx-1">·</span>
                          来源: {event.source}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 ml-8">
                      {event.actions.map((action, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px]">
                          <Zap className="h-2.5 w-2.5 text-primary" />
                          {action}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">已解决告警</CardTitle>
              <Badge variant="success">{resolvedEvents.length} 个</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {resolvedEvents.map((event) => {
                const config = riskConfig[event.level];
                return (
                  <div key={event.id} className="flex items-start gap-3 rounded-lg border p-3 opacity-70">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{event.title}</span>
                        <Badge variant="success" className="text-[10px]">已解决</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        解决于: {event.resolvedAt ? new Date(event.resolvedAt).toLocaleString("zh-CN") : "未知"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
