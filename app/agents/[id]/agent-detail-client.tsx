"use client";

import { PageHeader } from "@/components/ui/page-header";
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
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Play, Square, GitBranch, Loader2, Sparkles } from "lucide-react";
import type { Agent, Task, JournalEntry } from "@/lib/shared/types";
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
import type { MemoryEntry } from "@/lib/shared/types";

const statusConfig: Record<import("@/lib/shared/types").AgentStatus, { label: string; variant: "success" | "warning" | "danger" | "secondary"; dot: "success" | "idle" | "warning" | "danger" }> = {
  online: { label: "在线", variant: "success", dot: "success" },
  busy: { label: "忙碌", variant: "warning", dot: "warning" },
  error: { label: "异常", variant: "danger", dot: "danger" },
  offline: { label: "离线", variant: "secondary", dot: "idle" },
};

interface AgentDetailClientProps {
  agent: Agent & { subAgents: import("@/lib/shared/types").SubAgent[] };
  tasks: Task[];
  journal: JournalEntry[];
}

export function AgentDetailClient({ agent, tasks, journal }: AgentDetailClientProps) {
  const router = useRouter();
  const config = statusConfig[agent.status];
  const agentConfig = agent.config;

  // 运行控制
  const [busy, setBusy] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [spawnForm, setSpawnForm] = useState({ name: "", taskDescription: "" });
  // 上下文语义召回
  const [recalled, setRecalled] = useState<Array<MemoryEntry & { score: number }> | null>(null);
  const [recallLoading, setRecallLoading] = useState(false);

  // Real-time SSE stream
  const { events, connected } = useAgentStream(agent.id);

  // Journal data (client-side refresh)
  const { data: liveJournal, refetch: refetchJournal } = useAgentJournal(agent.id, 100);

  // Agent memories
  const { data: memories } = useFetch<MemoryEntry[]>(
    `/api/memory?agentId=${agent.id}&limit=6`
  );

  // 上下文语义召回：按 agent 目标/领域检索其记忆（Milvus）
  useEffect(() => {
    const goals = (agentConfig?.goals ?? []).map((g) => g.text).join(" ");
    const expertise = (agentConfig?.persona?.expertise ?? []).join(" ");
    const q = `${goals} ${expertise} ${agent.name}`.trim();
    if (!q) return;
    setRecallLoading(true);
    fetch(`/api/memory/search?agentId=${agent.id}&q=${encodeURIComponent(q)}&limit=5`)
      .then((r) => r.json())
      .then((j) => setRecalled(j.data ?? []))
      .catch(() => {})
      .finally(() => setRecallLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  const displayJournal = liveJournal ?? journal;
  const displayMood = agentConfig?.mood ?? { state: "focused" as const, energy: 0.5, lastUpdated: new Date().toISOString() };
  const hasValidConfig = agentConfig?.persona && agentConfig?.goals;

  async function runOnce() {
    setBusy(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/run`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "运行失败");
      toast.success(`已执行第 ${json.data?.cycle} 轮循环`);
      refetchJournal();
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRuntime() {
    setBusy(true);
    const isOnline = agent.status !== "offline";
    try {
      const res = await fetch(`/api/agents/${agent.id}/${isOnline ? "stop" : "start"}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "操作失败");
      toast.success(isOnline ? "已停止运行时节律" : "已启动运行时节律");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function spawnSubAgent() {
    setBusy(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/spawn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spawnForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "派生失败");
      toast.success(`子 Agent「${json.data.name}」已派生（消息已进入 RAK 环）`);
      setSpawnOpen(false);
      setSpawnForm({ name: "", taskDescription: "" });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageTransition className="space-y-6">
      {/* Top bar */}
      <PageHeader
        breadcrumb={<Link href="/agents" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Agent 管理</Link>}
        title={<span className="flex items-center gap-2">{agent.name}<StatusDot status={config.dot} pulse={agent.status === "online"} /></span>}
        description={agent.type}
        actions={<div className="flex items-center gap-3">
          <AgentHeartbeatViz
            mood={displayMood.state}
            energy={displayMood.energy}
            online={agent.status !== "offline"}
          />
          <Badge variant={config.variant}>
            {config.label}
          </Badge>
        </div>}
      />

      {/* 运行控制 */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void runOnce()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
          立即运行一轮
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void toggleRuntime()}>
          {agent.status !== "offline" ? <Square className="h-3.5 w-3.5 mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
          {agent.status !== "offline" ? "停止时节律" : "启动时节律"}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setSpawnOpen(true)}>
          <GitBranch className="h-3.5 w-3.5 mr-1" />
          派生子 Agent
        </Button>
        {agent.subAgents.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {agent.subAgents.map((s) => (
              <Badge key={s.id} variant="secondary" className="text-tiny">{s.name}</Badge>
            ))}
          </div>
        )}
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
              <CheckCircle2 className="h-4 w-4 text-success" />
              完成率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
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

      {/* 上下文语义召回（Milvus 混合检索） */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            上下文语义召回
            {recallLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            按 Agent 目标/领域经 Milvus 混合检索（dense + BM25）召回的记忆，是运行时上下文的来源
          </p>
          {recalled && recalled.length > 0 ? (
            <div className="divide-y rounded-lg border">
              {recalled.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2">
                  <Badge variant="secondary" className="text-tiny shrink-0">{(m as MemoryEntry & { score: number }).score}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs line-clamp-1">{m.content}</p>
                    <p className="text-tiny text-muted-foreground">{m.title}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {recalled ? "暂无召回结果（可为该 Agent 写入记忆后重试）" : "正在检索..."}
            </p>
          )}
        </CardContent>
      </Card>

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
                      task.status === "completed" ? "text-success bg-success/10 border-0" :
                      task.status === "running" ? "text-info bg-info/10 border-0" :
                      task.status === "failed" ? "text-destructive bg-destructive/10 border-0" :
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

      {/* 派生子 Agent */}
      <Dialog open={spawnOpen} onOpenChange={setSpawnOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>派生 Sub-Agent</DialogTitle>
            <DialogDescription>子 Agent 创建后，父 Agent 会向其发送任务消息进入 RAK 协调环</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>子 Agent 名称</Label>
              <Input value={spawnForm.name} onChange={(e) => setSpawnForm({ ...spawnForm, name: e.target.value })} placeholder="如：选品调研助手" />
            </div>
            <div className="space-y-2">
              <Label>任务描述</Label>
              <Textarea value={spawnForm.taskDescription} onChange={(e) => setSpawnForm({ ...spawnForm, taskDescription: e.target.value })}
                placeholder="交给子 Agent 的具体任务" rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpawnOpen(false)}>取消</Button>
            <Button onClick={() => void spawnSubAgent()} disabled={busy || !spawnForm.name.trim()}>
              {busy ? "派发中..." : "派生子 Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
