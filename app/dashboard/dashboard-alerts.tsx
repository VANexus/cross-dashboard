"use client";

import { StatusDot } from "@/components/ui/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Alert } from "@/lib/types";

interface DashboardAlertsProps {
  alerts: Alert[];
}

export function DashboardAlerts({ alerts }: DashboardAlertsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" /> 最近告警
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {alerts.map((a) => (
            <Link
              key={a.id}
              href={a.href}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
            >
              <StatusDot
                status={a.level === "danger" ? "danger" : a.level === "warning" ? "warning" : "info"}
              />
              <span className="text-sm flex-1">{a.message}</span>
              <span className="text-[11px] text-muted-foreground/60">{a.time}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
