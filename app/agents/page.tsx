"use client";

import { agents } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import {
  Bot,
  Activity,
  Zap,
  Brain,
  Shield,
  Palette,
  AlertTriangle,
  CheckCircle2,
  Clock,
  WifiOff,
  ChevronRight,
  BarChart3,
} from "lucide-react";

const agentIcons: Record<string, React.ReactNode> = {
  "sentinel-001": <Shield className="h-4 w-4" />,
  "dispatch-001": <Zap className="h-4 w-4" />,
  "ops-001": <Activity className="h-4 w-4" />,
  "risk-001": <AlertTriangle className="h-4 w-4" />,
  "legal-001": <Bot className="h-4 w-4" />,
  "marketing-001": <Palette className="h-4 w-4" />,
};

const agentWorkflows: Record<string, string[]> = {
  "sentinel-001": ["系统监控"],
  "dispatch-001": ["任务调度"],
  "ops-001": ["选品工作流", "库销比", "AI上架"],
  "risk-001": ["账号风险", "竞品广告"],
  "legal-001": ["专利检测"],
  "marketing-001": ["AI作图", "AI广告"],
};

const statusConfig = {
  online: { color: "success" as const, icon: CheckCircle2, label: "在线" },
  busy: { color: "warning" as const, icon: Activity, label: "忙碌" },
  error: { color: "danger" as const, icon: AlertTriangle, label: "异常" },
  offline: { color: "secondary" as const, icon: WifiOff, label: "离线" },
};

export default function AgentsPage() {
  const onlineCount = agents.filter((a) => a.status === "online").length;
  const busyCount = agents.filter((a) => a.status === "busy").length;
  const errorCount = agents.filter((a) => a.status === "error").length;
  const offlineCount = agents.filter((a) => a.status === "offline").length;

  return (
    <PageTransition className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Agent 管理</h1>
          <p className="text-xs text-muted-foreground">监控和管理 FlowMind 系统中的所有智能体</p>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-5">
        {[
          { label: "总 Agent", value: agents.length, color: "text-foreground" },
          { label: "在线", value: onlineCount, color: "text-emerald-400" },
          { label: "忙碌", value: busyCount, color: "text-amber-400" },
          { label: "异常", value: errorCount, color: "text-red-400" },
          { label: "离线", value: offlineCount, color: "text-muted-foreground" },
        ].map((stat) => (
          <Card key={stat.label} className="workflow-card">
            <CardContent className="p-3 text-center">
              <p className={cn("text-lg font-bold metric-value", stat.color)}>
                <AnimatedNumber value={stat.value} />
              </p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => {
          const config = statusConfig[agent.status];
          const Icon = config.icon;
          const workflows = agentWorkflows[agent.id] || [];
          return (
            <Link key={agent.id} href={`/agents/${agent.id}`}>
              <Card className="workflow-card group cursor-pointer hover:bg-muted/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50">
                        {agentIcons[agent.id] || <Bot className="h-4 w-4" />}
                      </div>
                      <div>
                        <CardTitle className="text-sm">{agent.name}</CardTitle>
                        <p className="text-[10px] text-muted-foreground font-mono">{agent.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={agent.status === "online" ? "success" : agent.status === "busy" ? "warning" : agent.status === "error" ? "danger" : "idle"} size="sm" pulse={agent.status === "online" || agent.status === "busy"} />
                      <span className="text-xs text-muted-foreground">{config.label}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">{agent.description}</p>

                  <div className="flex flex-wrap gap-1">
                    {workflows.map((wf) => (
                      <Badge key={wf} variant="outline" className="text-[9px] h-4 px-1.5">
                        {wf}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <BarChart3 className="h-3 w-3" />
                      <span>{agent.taskCount} 任务</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      <span>{agent.successRate}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Activity className="h-3 w-3" />
                      <span>{agent.uptime}%</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </PageTransition>
  );
}
