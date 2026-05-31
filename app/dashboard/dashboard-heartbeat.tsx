"use client";

import { StatusDot } from "@/components/ui/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import type { Agent } from "@/lib/types";

const statusMap: Record<string, "success" | "warning" | "danger" | "idle"> = {
  online: "success",
  busy: "warning",
  error: "danger",
  offline: "idle",
};

export function DashboardHeartbeat({ agents }: { agents: Agent[] }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Agent 心跳
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {agents.map((agent, i) => {
          const dotStatus = statusMap[agent.status] ?? "idle";
          const barCount = Math.round(agent.successRate / 10); // 0-10 bars based on successRate
          return (
            <div key={agent.id} className="flex items-center gap-3">
              <StatusDot status={dotStatus} pulse={agent.status === "online"} size="sm" />
              <span className="text-sm flex-1">{agent.name}</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 12 }).map((_, j) => (
                  <div
                    key={j}
                    className={`w-1 rounded-full ${j < barCount ? "bg-emerald-500" : "bg-muted"}`}
                    style={{ height: `${8 + ((i * 3 + j * 7) % 12)}px`, opacity: j < barCount ? 0.7 + ((j * 5) % 3) * 0.1 : 0.2 }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground w-12 text-right">
                {agent.successRate}%
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
