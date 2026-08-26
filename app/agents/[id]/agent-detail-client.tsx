"use client";

import { PageTransition } from "@/components/ui/page-transition";
import { StatusDot } from "@/components/ui/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Activity,
  CheckCircle2,
  Bot,
  ListTodo,
} from "lucide-react";
import Link from "next/link";
import type { Agent, Task, JournalEntry } from "@/lib/types";
import { AgentPersonaCard } from "@/components/agents/agent-persona-card";
import { AgentGoalsPanel } from "@/components/agents/agent-goals-panel";
import { AgentMoodIndicator } from "@/components/agents/agent-mood-indicator";
import { AgentJournalTimeline } from "@/components/agents/agent-journal-timeline";
import { AgentActivityFeed } from "@/components/agents/agent-activity-feed";
import { AgentMemoryGallery } from "@/components/agents/agent-memory-gallery";
import { AgentHeartbeatViz } from "@/components/agents/agent-heartbeat-viz";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { useAgentJournal } from "@/hooks/use-agent-journal";
import { useFetch } from "@/hooks/use-fetch";
import type { MemoryEntry } from "@/lib/types";

const statusConfig: Record<import("@/lib/types").AgentStatus, { label: string; color: string; bg: string; dot: "success" | "idle" | "warning" | "danger" }> = {
  online: { label: "在线", color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "success" },
  busy: { label: "忙碌", color: "text-amber-500", bg: "bg-amber-500/10", dot: "warning" },
  error: { label: "异常", color: "text-red-500", bg: "bg-red-500/10", dot: "danger" },
  offline: { label: "离线", color: "text-muted-foreground", bg: "bg-muted", dot: "idle" },
};

interface AgentDetailClientProps {
  agent: Agent;
  tasks: Task[];
  journal: JournalEntry[];
}

export function AgentDetailClient({ agent, tasks, journal }: AgentDetailClientProps) {
  const config = statusConfig[agent.status];
  const agentConfig = agent.config;

  // Real-time SSE stream
  const { events, connected } = useAgentStream(agent.id);

  // Journal data (client-side refresh)
  const { data: liveJournal } = useAgentJournal(agent.id, 100);

  // Agent memories
  const { data: memories } = useFetch<MemoryEntry[]>(
    `/api/memory?agentId=${agent.id}&limit=6`
  );

  const displayJournal = liveJournal ?? journal;
  const displayMood = agentConfig?.mood ?? { state: "focused" as const, energy: 0.5, lastUpdated: new Date().toISOString() };
  const hasValidConfig = agentConfig?.persona && agentConfig?.goals;

  return (
    <PageTransition className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/agents">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {agent.name}
              <StatusDot status={config.dot} pulse={agent.status === "online"} />
            </h1>
            <p className="text-muted-foreground text-sm">{agent.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AgentHeartbeatViz
            mood={displayMood.state}
            energy={displayMood.energy}
            online={agent.status !== "offline"}
          />
          <Badge variant="outline" className={`${config.color} ${config.bg} border-0`}>
            {config.label}
          </Badge>
        </div>
      </div>

      {/* Row 1: Persona + Mood + Goals */}
      <div className="grid gap-4 grid-cols-3">
        {hasValidConfig ? (
          <AgentPersonaCard config={agentConfig!} />
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                Agent 信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{agent.description}</p>
              <div className="mt-2 flex gap-2">
                <Badge variant="secondary">L{agent.reflexLevel}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <AgentMoodIndicator mood={displayMood} />

        {hasValidConfig ? (
          <AgentGoalsPanel goals={agentConfig!.goals} />
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">目标进度</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">暂无设定目标</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 2: Stats */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              运行状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mt-1">
              最后活跃: {agent.lastHeartbeat}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              任务完成: {agent.taskCount} | 成功率: {agent.successRate}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-primary" />
              关联任务
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {tasks.filter((t) => t.status === "running").length} 运行中
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              完成率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {tasks.length > 0
                ? Math.round((tasks.filter((t) => t.status === "completed").length / tasks.length) * 100)
                : 0}%
            </div>
            <Progress
              value={tasks.length > 0 ? (tasks.filter((t) => t.status === "completed").length / tasks.length) * 100 : 0}
              className="h-1.5 mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Real-time Activity Feed (SSE) */}
      <AgentActivityFeed events={events} connected={connected} />

      {/* Row 4: Journal Timeline */}
      <AgentJournalTimeline entries={displayJournal} />

      {/* Row 5: Memory Gallery */}
      <AgentMemoryGallery memories={memories ?? []} />

      {/* Row 6: Task list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            任务列表
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">暂无关联任务</p>
          ) : (
            <div className="divide-y">
              {tasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <StatusDot
                    status={
                      task.status === "running" ? "success" :
                      task.status === "completed" ? "idle" :
                      task.status === "failed" ? "danger" : "warning"
                    }
                    pulse={task.status === "running"}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.priority}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      task.status === "completed" ? "text-emerald-500 bg-emerald-500/10 border-0" :
                      task.status === "running" ? "text-blue-500 bg-blue-500/10 border-0" :
                      task.status === "failed" ? "text-red-500 bg-red-500/10 border-0" :
                      "text-muted-foreground bg-muted border-0"
                    }
                  >
                    {task.status === "completed" ? "已完成" :
                     task.status === "running" ? "运行中" :
                     task.status === "failed" ? "失败" : task.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageTransition>
  );
}
