"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Brain, Eye, Lightbulb, GitBranch } from "lucide-react";
import type { JournalEntry } from "@/lib/shared/types";

interface AgentJournalTimelineProps {
  entries: JournalEntry[];
  loading?: boolean;
}

const typeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  thought: { icon: <Brain className="h-3 w-3" />, label: "思考", color: "text-viz-1 bg-viz-1/10" },
  observation: { icon: <Eye className="h-3 w-3" />, label: "观察", color: "text-viz-4 bg-viz-4/10" },
  decision: { icon: <GitBranch className="h-3 w-3" />, label: "决策", color: "text-viz-3 bg-viz-3/10" },
  reflection: { icon: <Lightbulb className="h-3 w-3" />, label: "反思", color: "text-viz-2 bg-viz-2/10" },
};

function groupByDay(entries: JournalEntry[]): Record<string, JournalEntry[]> {
  const groups: Record<string, JournalEntry[]> = {};
  for (const entry of entries) {
    const day = new Date(entry.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
    (groups[day] ??= []).push(entry);
  }
  return groups;
}

export function AgentJournalTimeline({ entries, loading }: AgentJournalTimelineProps) {
  const grouped = groupByDay(entries);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          思考日志
          <Badge variant="secondary" className="text-tiny ml-auto">{entries.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">加载中...</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">暂无记录</p>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Object.entries(grouped).map(([day, dayEntries]) => (
              <div key={day}>
                <p className="text-tiny font-medium text-muted-foreground mb-2">{day}</p>
                <div className="space-y-2 border-l-2 border-muted pl-3">
                  {dayEntries.map((entry) => {
                    const cfg = typeConfig[entry.type] ?? typeConfig.thought;
                    return (
                      <div key={entry.id} className="flex gap-2">
                        <Badge variant="outline" className={`text-tiny border-0 shrink-0 ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </Badge>
                        <p className="text-xs text-muted-foreground leading-relaxed">{entry.content}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
