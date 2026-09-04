"use client";

import { PageHeader } from "@/components/ui/page-header";
import { PageTransition } from "@/components/ui/page-transition";
import { StatusDot } from "@/components/ui/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  Activity,
  Clock,
  ArrowRight,
  Plus,
  Trash2,
  Play,
  Square,
  Loader2,
  Sparkles,
  Users,
  Wand2,
  LayoutTemplate,
  GitBranch,
  UserCheck,
  UserMinus,
} from "lucide-react";
import type { Agent, AgentStatus, AgentTemplate, MoodState, Team } from "@/lib/shared/types";
import { ageLabel } from "@/lib/time";

const statusConfig: Record<AgentStatus, { label: string; variant: "success" | "warning" | "danger" | "secondary"; dot: "success" | "idle" | "warning" | "danger" }> = {
  online: { label: "在线", variant: "success", dot: "success" },
  busy: { label: "忙碌", variant: "warning", dot: "warning" },
  error: { label: "异常", variant: "danger", dot: "danger" },
  offline: { label: "离线", variant: "secondary", dot: "idle" },
};

const moodEmojis: Record<MoodState, string> = {
  focused: "\u{1F3AF}",
  alert: "\u{1F441}\u{FE0F}",
  tired: "\u{1F634}",
  stressed: "\u{1F625}",
  curious: "\u{1F913}",
  satisfied: "\u{1F60A}",
};

const PRESET_TYPES = new Set(["sentinel", "dispatch", "operations", "risk_control", "legal", "marketing"]);

const HUE_BY_TYPE: Record<string, number> = {
  sentinel: 210,
  dispatch: 265,
  operations: 150,
  risk_control: 0,
  legal: 280,
  marketing: 30,
};

function typeHue(type: string): number {
  if (HUE_BY_TYPE[type] !== undefined) return HUE_BY_TYPE[type];
  // 动态类型：由字符串哈希到稳定色相
  let h = 0;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) % 360;
  return h;
}

function AgentGlyph({ type }: { type: string }) {
  const hue = typeHue(type);
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 48%), hsl(${(hue + 40) % 360} 70% 40%))` }}
    >
      <Bot className="h-5 w-5" />
    </div>
  );
}

const EXAMPLES = [
  "创建一个负责物流时效监控与预警的 Agent",
  "创建一个专注竞品价格追踪的 Agent",
];

interface AgentsClientProps {
  initialData: Agent[];
}

export function AgentsClient({ initialData }: AgentsClientProps) {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>(initialData);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // 一句话生成
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  // 一句话组建团队
  const [teamPrompt, setTeamPrompt] = useState("");
  const [teamGenerating, setTeamGenerating] = useState(false);

  async function refresh() {
    router.refresh();
    const [agentsRes, templatesRes, teamsRes] = await Promise.all([
      fetch("/api/agents"),
      fetch("/api/agent-templates"),
      fetch("/api/teams"),
    ]);
    const a = await agentsRes.json();
    const t = await templatesRes.json();
    const tm = await teamsRes.json();
    if (a.data) setAgents(a.data);
    if (t.data) setTemplates(t.data);
    if (tm.data) setTeams(tm.data);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error("请输入一句话描述想要的 Agent");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/agents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "生成失败");
      toast.success(`Agent「${json.data.name}」已动态生成并启动`);
      setPrompt("");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateTeam() {
    if (!teamPrompt.trim()) {
      toast.error("请输入一句话描述团队目标");
      return;
    }
    setTeamGenerating(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: teamPrompt.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "组建失败");
      toast.success(`团队「${json.data.name}」已动态组建（${json.data.members?.length ?? 0} 个 Agent）`);
      setTeamPrompt("");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTeamGenerating(false);
    }
  }

  async function handleInstantiate(template: AgentTemplate) {
    setBusyId(`tpl-${template.id}`);
    try {
      const res = await fetch(`/api/agent-templates/${template.id}/instantiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "实例化失败");
      toast.success(`模板「${template.name}」已实例化为运行中的 Agent`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAgent(agent: Agent) {
    setBusyId(agent.id);
    const isOnline = agent.status !== "offline";
    const endpoint = isOnline ? "stop" : "start";
    try {
      const res = await fetch(`/api/agents/${agent.id}/${endpoint}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "操作失败");
      toast.success(isOnline ? `已停止 ${agent.name} 运行时节律` : `已启动 ${agent.name} 运行时节律`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(agent: Agent) {
    if (!confirm(`确认删除 Agent「${agent.name}」？将级联删除其子 Agent、日志与进化记录。`)) return;
    setBusyId(agent.id);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "删除失败");
      toast.success(`Agent「${agent.name}」已删除`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemoveMember(teamId: string, agentId: string) {
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeMembers: [agentId] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "操作失败");
      toast.success("已移除团队成员");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleDeleteTeam(team: Team) {
    if (!confirm(`确认解散团队「${team.name}」？（Agent 本身保留）`)) return;
    try {
      const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "解散失败");
      toast.success(`团队「${team.name}」已解散`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  return (
    <PageTransition className="space-y-8">
      <PageHeader
        title="Agent 管理"
        description="不定死固定数量：主 Agent 一句话动态生成 / 预设模板一键实例化 / 团队动态组建 → 自动接入运行时节律与协同拓扑"
      />

      {/* ── 一句话动态生成（核心入口） ── */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4 text-primary" />
            一句话创建 Agent
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            AI 自动生成完整独立人格提示词（角色定位 + 职责 + 目标 + 专业领域），并参考现有 6 个预设模板；创建后立即进入运行时节律
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleGenerate()}
              placeholder="例如：创建一个负责物流时效监控与预警的 Agent"
              className="flex-1"
            />
            <Button onClick={() => void handleGenerate()} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              {generating ? "生成中..." : "生成 Agent"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-tiny text-muted-foreground">试试：</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-tiny text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                {ex}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Agent 列表（动态） ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            运行中的 Agent <span className="font-mono text-caption text-muted-foreground">({agents.length})</span>
          </h2>
        </div>
        <div className="grid gap-4 grid-cols-2">
          {agents.length === 0 && (
            <div className="col-span-2 flex flex-col items-center justify-center rounded-xl border border-dashed py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-medium">暂无 Agent</p>
              <p className="mt-1 text-xs text-muted-foreground">
                在上方输入一句话，或从下方预设模板一键实例化
              </p>
            </div>
          )}
          {agents.map((agent) => {
            const config = statusConfig[agent.status];
            const mood = agent.config?.mood;
            const goals = agent.config?.goals ?? [];
            const topGoal = goals.find((g) => g.priority === "high") ?? goals[0];
            const emoji = mood ? (moodEmojis[mood.state] ?? "🤖") : "🤖";
            const isBusy = busyId === agent.id;
            const isOnline = agent.status !== "offline";
            const isPreset = PRESET_TYPES.has(agent.type) && (agent.name.startsWith("哨兵") || agent.name.startsWith("调度") || agent.name.startsWith("运营") || agent.name.startsWith("风控") || agent.name.startsWith("法务") || agent.name.startsWith("营销"));
            const expertise = agent.config?.persona?.expertise ?? [];

            return (
              <div key={agent.id} className="h-full">
                <Link href={`/agents/${agent.id}`} className="block h-full focus:outline-none">
                  <Card className="cursor-pointer hover:border-primary/50 transition-all duration-200 group h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <AgentGlyph type={agent.type} />
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {agent.name}
                              <span className="text-lg" title={mood?.state}>{emoji}</span>
                              <StatusDot status={config.dot} pulse={isOnline} size="sm" />
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{agent.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isPreset ? (
                            <Badge variant="secondary" className="text-tiny">预设</Badge>
                          ) : (
                            <Badge className="text-tiny bg-primary/15 text-primary border-primary/30">动态</Badge>
                          )}
                          <Badge variant={config.variant} className="text-xs">
                            {config.label}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">{agent.description}</p>

                      {topGoal && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-tiny text-muted-foreground truncate flex-1">{topGoal.text}</p>
                            <span className="text-tiny text-muted-foreground ml-2">{Math.round(topGoal.progress * 100)}%</span>
                          </div>
                          <Progress value={topGoal.progress * 100} className="h-1" />
                        </div>
                      )}

                      {expertise.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">专业领域</p>
                          <div className="flex flex-wrap gap-1">
                            {expertise.slice(0, 5).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-tiny">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {ageLabel(agent.lastHeartbeat)}
                        </span>
                        <span className="flex items-center gap-1 group-hover:text-primary transition-colors">
                          查看详情 <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={isOnline ? "outline" : "default"}
                    className="flex-1"
                    disabled={isBusy}
                    onClick={() => void toggleAgent(agent)}
                  >
                    {isBusy ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : isOnline ? (
                      <Square className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <Play className="h-3.5 w-3.5 mr-1" />
                    )}
                    {isOnline ? "停止" : "启动"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={isBusy}
                    onClick={() => void handleDelete(agent)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 预设模板库（一句话生成的参考底座 + 一键实例化） ── */}
      <div>
        <div className="mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-primary" />
            预设模板库 <span className="font-mono text-caption text-muted-foreground">({templates.length})</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            现有人格固化为模板：一句话动态生成时会自动参考它们保持同质量；也可直接一键实例化为运行中的 Agent
          </p>
        </div>
        <div className="grid gap-3 grid-cols-3">
          {templates.map((t) => {
            const hue = typeHue(t.type);
            const isBusy = busyId === `tpl-${t.id}`;
            return (
              <Card key={t.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <AgentGlyph type={t.type} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-tiny text-muted-foreground font-mono truncate">{t.type}</p>
                    </div>
                  </div>
                  <p className="text-tiny text-muted-foreground line-clamp-2 flex-1">{t.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {(t.config.persona?.expertise ?? []).slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-tiny" style={{ opacity: 0.9 }}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-1"
                    disabled={isBusy}
                    onClick={() => void handleInstantiate(t)}
                  >
                    {isBusy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                    实例化运行
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── 动态团队 ── */}
      <div>
        <div className="mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            动态组建的团队 <span className="font-mono text-caption text-muted-foreground">({teams.length})</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            一句话让主 Agent 自动生成职责互补的多个 Agent 并组队，协同拓扑按团队分组展示
          </p>
        </div>

        <Card className="mb-4 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Input
                value={teamPrompt}
                onChange={(e) => setTeamPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleGenerateTeam()}
                placeholder="例如：组建一个团队，负责新品上市的选品、作图、定价与广告投放"
                className="flex-1"
              />
              <Button onClick={() => void handleGenerateTeam()} disabled={teamGenerating} variant="secondary">
                {teamGenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <GitBranch className="h-4 w-4 mr-1" />}
                {teamGenerating ? "组建中..." : "一句话组建团队"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {teams.length === 0 && (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              暂无团队。用一句话组建一个，多个 Agent 将自动分工并形成协同拓扑
            </div>
          )}
          {teams.map((team) => (
            <Card key={team.id}>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{team.name}</p>
                      <p className="text-tiny text-muted-foreground font-mono">{team.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {team.leaderAgentId && (
                      <Badge variant="secondary" className="text-tiny flex items-center gap-1">
                        <UserCheck className="h-3 w-3" />
                        组长 {agentById.get(team.leaderAgentId)?.name ?? team.leaderAgentId}
                      </Badge>
                    )}
                    <Badge className="text-tiny">{team.members.length} 名成员</Badge>
                    <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0" onClick={() => void handleDeleteTeam(team)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{team.goal}</p>
                <div className="flex flex-wrap gap-1.5">
                  {team.members.map((m) => {
                    const a = agentById.get(m.agentId);
                    return (
                      <span
                        key={m.agentId}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-tiny text-muted-foreground"
                      >
                        <i
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: a ? `hsl(${typeHue(a.type)} 70% 50%)` : "var(--muted-foreground)" }}
                        />
                        {a?.name ?? m.agentId}
                        {m.role === "leader" && <span className="text-primary">· 组长</span>}
                        <button
                          className="ml-0.5 text-muted-foreground/50 hover:text-destructive"
                          onClick={() => void handleRemoveMember(team.id, m.agentId)}
                          title="移出团队"
                        >
                          <UserMinus className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
