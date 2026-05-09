"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Agent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Bot, Wifi, WifiOff, AlertTriangle, Loader2 } from "lucide-react";

const statusConfig = {
  online: { label: "在线", color: "bg-emerald-500", icon: Wifi, badgeVariant: "success" as const },
  busy: { label: "忙碌", color: "bg-amber-500", icon: Loader2, badgeVariant: "warning" as const },
  error: { label: "异常", color: "bg-red-500", icon: AlertTriangle, badgeVariant: "danger" as const },
  offline: { label: "离线", color: "bg-gray-400", icon: WifiOff, badgeVariant: "secondary" as const },
};

const typeLabels: Record<string, string> = {
  sentinel: "哨兵",
  dispatch: "调度",
  operations: "运营",
  risk_control: "风控",
  legal: "法务",
  marketing: "营销",
};

export function AgentStatusCard({ agent }: { agent: Agent }) {
  const config = statusConfig[agent.status];
  const StatusIcon = config.icon;

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-md hover:border-primary/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10")}>
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{agent.name}</CardTitle>
              <span className="text-[11px] text-muted-foreground">{typeLabels[agent.type] || agent.type}</span>
            </div>
          </div>
          <Badge variant={config.badgeVariant} className="gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", config.color, agent.status === "busy" && "animate-pulse")} />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{agent.description}</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-muted/50 px-2 py-1.5">
            <div className="text-xs text-muted-foreground">正常运行</div>
            <div className="text-sm font-semibold">{agent.uptime}%</div>
          </div>
          <div className="rounded-md bg-muted/50 px-2 py-1.5">
            <div className="text-xs text-muted-foreground">任务数</div>
            <div className="text-sm font-semibold">{agent.taskCount}</div>
          </div>
          <div className="rounded-md bg-muted/50 px-2 py-1.5">
            <div className="text-xs text-muted-foreground">成功率</div>
            <div className="text-sm font-semibold">{agent.successRate}%</div>
          </div>
        </div>
        {agent.reflexLevel > 0 && (
          <div className="mt-2 flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-500">
            <AlertTriangle className="h-3 w-3" />
            反射等级 L{agent.reflexLevel}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
