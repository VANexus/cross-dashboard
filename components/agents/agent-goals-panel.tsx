"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";
import type { AgentGoal } from "@/lib/shared/types";

interface AgentGoalsPanelProps {
  goals: AgentGoal[];
}

const priorityColors: Record<string, string> = {
  high: "text-destructive bg-destructive/10",
  medium: "text-warning bg-warning/10",
  low: "text-muted-foreground bg-muted",
};

export function AgentGoalsPanel({ goals }: AgentGoalsPanelProps) {
  const safeGoals = goals ?? [];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          目标进度
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {safeGoals.length === 0 ? (
          <p className="text-xs text-muted-foreground">暂无设定目标</p>
        ) : (
          safeGoals.map((goal) => (
            <div key={goal.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium truncate flex-1">{goal.text}</p>
                <Badge variant="outline" className={`text-tiny border-0 ${priorityColors[goal.priority]}`}>
                  {goal.priority === "high" ? "高" : goal.priority === "medium" ? "中" : "低"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={goal.progress * 100} className="h-1.5 flex-1" />
                <span className="text-tiny text-muted-foreground w-8 text-right">
                  {Math.round(goal.progress * 100)}%
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
