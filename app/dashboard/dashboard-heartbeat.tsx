"use client";

import { StatusDot } from "@/components/ui/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

export function DashboardHeartbeat() {
  const agents = ["哨兵Agent", "调度Agent", "运营Agent", "风控Agent", "法务Agent", "营销Agent"];
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Agent 心跳
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {agents.map((name, i) => (
          <div key={name} className="flex items-center gap-3">
            <StatusDot status="success" pulse size="sm" />
            <span className="text-sm flex-1">{name}</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 12 }).map((_, j) => (
                <div
                  key={j}
                  className="w-1 rounded-full bg-emerald-500"
                  style={{ height: `${8 + ((i * 3 + j * 7) % 12)}px`, opacity: j > 9 ? 0.3 : 0.7 + ((j * 5) % 3) * 0.1 }}
                />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground w-12 text-right">
              {99 - i}.{(i * 7) % 9}%
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
