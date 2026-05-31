"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio, Brain, GitBranch, Eye, Lightbulb, Zap } from "lucide-react";
import type { AgentEvent } from "@/lib/types";

interface AgentActivityFeedProps {
  events: AgentEvent[];
  connected: boolean;
}

const eventConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  thought: { icon: <Brain className="h-3 w-3" />, label: "思考", color: "text-blue-400" },
  observation: { icon: <Eye className="h-3 w-3" />, label: "观察", color: "text-emerald-400" },
  decision: { icon: <GitBranch className="h-3 w-3" />, label: "决策", color: "text-amber-400" },
  reflection: { icon: <Lightbulb className="h-3 w-3" />, label: "反思", color: "text-purple-400" },
  mood_change: { icon: <Zap className="h-3 w-3" />, label: "情绪", color: "text-pink-400" },
  memory_created: { icon: <Brain className="h-3 w-3" />, label: "记忆", color: "text-cyan-400" },
};

export function AgentActivityFeed({ events, connected }: AgentActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Radio className={`h-4 w-4 ${connected ? "text-emerald-500 animate-pulse" : "text-muted-foreground"}`} />
          实时活动
          {connected && <span className="text-[10px] text-emerald-500">LIVE</span>}
          <Badge variant="secondary" className="text-[10px] ml-auto">{events.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {connected ? "等待活动..." : "未连接"}
          </p>
        ) : (
          <div ref={scrollRef} className="space-y-2 max-h-64 overflow-y-auto">
            {events.slice(0, 50).map((event, i) => {
              const cfg = eventConfig[event.type] ?? eventConfig.thought;
              const data = event.data;
              return (
                <div key={`${event.timestamp}-${i}`} className="flex items-start gap-2 py-1">
                  <span className={cfg.color}>{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">
                      {typeof data.content === "string" ? data.content :
                       typeof data.action === "string" ? `${data.action}: ${data.reason ?? ""}` :
                       JSON.stringify(data)}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(event.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
