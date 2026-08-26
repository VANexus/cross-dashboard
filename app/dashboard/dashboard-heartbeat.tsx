"use client";

import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/types";

interface DashboardHeartbeatProps {
  agents: Agent[];
}

function dotClass(status: string): string {
  if (status === "online") return "dash-dot ok";
  if (status === "busy" || status === "error") return "dash-dot warn";
  return "dash-dot idle";
}

/** 设计稿心跳波形：确定性高度序列，随 agent 平移错位 */
function barsFor(seed: number): number[] {
  return Array.from({ length: 12 }, (_, j) => 8 + ((seed * 5 + j * 7) % 14));
}

export function DashboardHeartbeat({ agents }: DashboardHeartbeatProps) {
  return (
    <div className="glass dash-panel">
      <div className="dash-panel-head">
        <span className="dash-panel-title">
          <Activity className="h-4 w-4" /> Agent 心跳
        </span>
      </div>
      <div>
        {agents.map((agent, i) => (
          <div key={agent.id} className="dash-hb-row">
            <span className={dotClass(agent.status)} />
            <span className="dash-hb-name" title={agent.name}>{agent.name}</span>
            <span className="dash-hb-bars">
              {barsFor(i + 1).map((h, j) => (
                <i key={j} style={{ height: `${h}px` }} className={cn(agent.status !== "online" && "opacity-40")} />
              ))}
            </span>
            <span className="dash-hb-val">{agent.successRate}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
