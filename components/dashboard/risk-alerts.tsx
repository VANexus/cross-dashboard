"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { riskEvents } from "@/lib/mock-data";
import type { RiskLevel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ShieldAlert, ShieldCheck, ShieldX, Clock } from "lucide-react";

const riskConfig: Record<RiskLevel, { label: string; color: string; icon: typeof ShieldAlert; badgeVariant: "warning" | "danger" | "destructive" | "success" }> = {
  safe: { label: "安全", color: "text-emerald-500", icon: ShieldCheck, badgeVariant: "success" },
  level3: { label: "Ⅲ级预警", color: "text-amber-500", icon: ShieldAlert, badgeVariant: "warning" },
  level2: { label: "Ⅱ级熔断", color: "text-orange-500", icon: ShieldAlert, badgeVariant: "danger" },
  level1: { label: "Ⅰ级隔离", color: "text-red-500", icon: ShieldX, badgeVariant: "destructive" },
};

export function RiskAlerts() {
  const activeEvents = riskEvents.filter((e) => !e.resolved);
  const recentEvents = riskEvents.slice(0, 4);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">风险告警</CardTitle>
            <p className="text-xs text-muted-foreground">
              {activeEvents.length} 个活跃告警
            </p>
          </div>
          <Badge variant={activeEvents.length > 0 ? "danger" : "success"}>
            {activeEvents.length > 0 ? "需关注" : "安全"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentEvents.map((event) => {
            const config = riskConfig[event.level];
            const Icon = config.icon;
            return (
              <div
                key={event.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                  event.resolved ? "opacity-60" : "hover:bg-muted/30"
                )}
              >
                <div className={cn("mt-0.5", config.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{event.title}</span>
                    <Badge variant={config.badgeVariant} className="shrink-0 text-[10px]">
                      {config.label}
                    </Badge>
                    {event.resolved && (
                      <Badge variant="success" className="shrink-0 text-[10px]">已解决</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(event.timestamp).toLocaleString("zh-CN")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
