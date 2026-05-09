"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, AlertTriangle, Loader2, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";

const statusConfig = {
  online: { label: "在线", color: "bg-emerald-500", badgeVariant: "success" as const },
  busy: { label: "忙碌", color: "bg-amber-500", badgeVariant: "warning" as const },
  error: { label: "异常", color: "bg-red-500", badgeVariant: "danger" as const },
  offline: { label: "离线", color: "bg-gray-400", badgeVariant: "secondary" as const },
};

const typeLabels: Record<string, string> = {
  sentinel: "哨兵",
  dispatch: "调度",
  operations: "运营",
  risk_control: "风控",
  legal: "法务",
  marketing: "营销",
};

export function AgentCard({ agent }: { agent: Agent }) {
  const config = statusConfig[agent.status];
  const lastHB = new Date(agent.lastHeartbeat);
  const timeAgo = Math.floor((Date.now() - lastHB.getTime()) / 60000);

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg hover:border-primary/30">
      <div className={cn("absolute top-0 left-0 h-full w-1", config.color)} />
      <CardHeader className="pb-2 pl-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10",
              agent.status === "busy" && "animate-pulse"
            )}>
              <span className="text-lg">{typeLabels[agent.type]?.[0]}</span>
              <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card", config.color)} />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{agent.name}</h3>
              <span className="text-[11px] text-muted-foreground">ID: {agent.id}</span>
            </div>
          </div>
          <Badge variant={config.badgeVariant}>{config.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pl-5 space-y-3">
        <p className="text-xs text-muted-foreground line-clamp-2">{agent.description}</p>

        <div className="grid grid-cols-4 gap-2">
          <div className="text-center rounded bg-muted/40 py-1.5">
            <div className="text-[10px] text-muted-foreground">运行率</div>
            <div className="text-xs font-bold">{agent.uptime}%</div>
          </div>
          <div className="text-center rounded bg-muted/40 py-1.5">
            <div className="text-[10px] text-muted-foreground">任务数</div>
            <div className="text-xs font-bold">{agent.taskCount}</div>
          </div>
          <div className="text-center rounded bg-muted/40 py-1.5">
            <div className="text-[10px] text-muted-foreground">成功率</div>
            <div className="text-xs font-bold">{agent.successRate}%</div>
          </div>
          <div className="text-center rounded bg-muted/40 py-1.5">
            <div className="text-[10px] text-muted-foreground">反射级</div>
            <div className="text-xs font-bold">L{agent.reflexLevel}</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {timeAgo < 1 ? "刚刚" : `${timeAgo}分钟前`} 心跳
          </div>
          <Link href={`/agents/${agent.id}`}>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              详情 <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
