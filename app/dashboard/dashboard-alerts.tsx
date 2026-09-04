"use client";

import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Alert } from "@/lib/shared/types";

interface DashboardAlertsProps {
  alerts: Alert[];
}

function dotClass(level: Alert["level"]): string {
  if (level === "danger") return "dash-dot danger";
  if (level === "warning") return "dash-dot warn";
  return "dash-dot idle";
}

export function DashboardAlerts({ alerts }: DashboardAlertsProps) {
  return (
    <div className="glass dash-panel">
      <div className="dash-panel-head">
        <span className="dash-panel-title">
          <ShieldAlert className="h-4 w-4" /> 最近告警
        </span>
        <span className="dash-panel-more">全部</span>
      </div>
      <div className="divide-y divide-transparent">
        {alerts.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">暂无告警，一切正常。</p>
        )}
        {alerts.map((a) => (
          <div key={a.id} className="dash-alert-row">
            <span className={dotClass(a.level)} />
            <div className="min-w-0">
              <div className="dash-alert-msg truncate">{a.message}</div>
              <div className="dash-alert-sub truncate">{a.href || "需人工复核"}</div>
            </div>
            <span className={cn("dash-alert-time")}>{a.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
