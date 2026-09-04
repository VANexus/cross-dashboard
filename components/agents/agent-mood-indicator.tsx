"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Heart } from "lucide-react";
import type { AgentMood, MoodState } from "@/lib/shared/types";

interface AgentMoodIndicatorProps {
  mood: AgentMood;
}

const moodConfig: Record<MoodState, { emoji: string; label: string; color: string }> = {
  focused: { emoji: "\u{1F3AF}", label: "专注", color: "text-viz-1" },
  alert: { emoji: "\u{1F441}\u{FE0F}", label: "警觉", color: "text-viz-3" },
  tired: { emoji: "\u{1F634}", label: "疲惫", color: "text-muted-foreground" },
  stressed: { emoji: "\u{1F625}", label: "压力", color: "text-destructive" },
  curious: { emoji: "\u{1F913}", label: "好奇", color: "text-viz-2" },
  satisfied: { emoji: "\u{1F60A}", label: "满足", color: "text-viz-4" },
};

export function AgentMoodIndicator({ mood }: AgentMoodIndicatorProps) {
  const config = moodConfig[mood.state] ?? moodConfig.focused;
  const energyPercent = Math.round(mood.energy * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          情绪状态
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{config.emoji}</span>
          <div>
            <p className={`text-sm font-medium ${config.color}`}>{config.label}</p>
            <p className="text-tiny text-muted-foreground">{mood.state}</p>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">能量</span>
            <span className="text-xs font-medium">{energyPercent}%</span>
          </div>
          <Progress
            value={energyPercent}
            className={`h-1.5 ${energyPercent < 30 ? "text-destructive" : energyPercent < 60 ? "text-warning" : "text-success"}`}
          />
        </div>
        <p className="text-tiny text-muted-foreground">
          更新: {new Date(mood.lastUpdated).toLocaleString("zh-CN")}
        </p>
      </CardContent>
    </Card>
  );
}
