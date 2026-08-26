"use client";

import { PageTransition } from "@/components/ui/page-transition";
import { StatusDot } from "@/components/ui/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Search,
  Activity,
  Clock,
  Zap,
  BarChart3,
  ArrowRight,
  Settings,
} from "lucide-react";
import Link from "next/link";
import type { Agent, AgentStatus, MoodState } from "@/lib/types";

const agentIcons: Record<string, React.ReactNode> = {
  "哨兵Agent": <Search className="h-5 w-5" />,
  "调度Agent": <Activity className="h-5 w-5" />,
  "运营Agent": <BarChart3 className="h-5 w-5" />,
  "风控Agent": <Zap className="h-5 w-5" />,
  "法务Agent": <Settings className="h-5 w-5" />,
  "营销Agent": <BarChart3 className="h-5 w-5" />,
};

const agentWorkflows: Record<string, string[]> = {
  "哨兵Agent": ["选品研究", "竞品监控"],
  "调度Agent": ["任务编排", "工作流调度"],
  "运营Agent": ["AI 上架", "Listing 优化"],
  "风控Agent": ["风险识别", "合规检测"],
  "法务Agent": ["侵权检测", "品牌保护"],
  "营销Agent": ["AI 广告", "营销优化"],
};

const statusConfig: Record<AgentStatus, { label: string; color: string; bg: string; dot: "success" | "idle" | "warning" | "danger" }> = {
  online: { label: "在线", color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "success" },
  busy: { label: "忙碌", color: "text-amber-500", bg: "bg-amber-500/10", dot: "warning" },
  error: { label: "异常", color: "text-red-500", bg: "bg-red-500/10", dot: "danger" },
  offline: { label: "离线", color: "text-muted-foreground", bg: "bg-muted", dot: "idle" },
};

const moodEmojis: Record<MoodState, string> = {
  focused: "\u{1F3AF}",
  alert: "\u{1F441}\u{FE0F}",
  tired: "\u{1F634}",
  stressed: "\u{1F625}",
  curious: "\u{1F913}",
  satisfied: "\u{1F60A}",
};

interface AgentsClientProps {
  initialData: Agent[];
}

export function AgentsClient({ initialData }: AgentsClientProps) {
  return (
    <PageTransition className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent 管理</h1>
          <p className="text-muted-foreground text-sm">
            管理和监控所有智能代理的状态与配置
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-1" />
            批量配置
          </Button>
          <Button size="sm">
            <Bot className="h-4 w-4 mr-1" />
            添加 Agent
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2">
        {initialData.map((agent) => {
          const config = statusConfig[agent.status];
          const mood = agent.config?.mood;
          const goals = agent.config?.goals ?? [];
          const topGoal = goals.find((g) => g.priority === "high") ?? goals[0];
          const emoji = mood ? (moodEmojis[mood.state] ?? "\u{1F916}") : "\u{1F916}";

          return (
            <Link key={agent.id} href={`/agents/${agent.id}`}>
              <Card className="cursor-pointer hover:border-primary/50 transition-all duration-200 group h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {agentIcons[agent.name] || <Bot className="h-5 w-5" />}
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {agent.name}
                          <span className="text-lg" title={mood?.state}>{emoji}</span>
                          <StatusDot status={config.dot} pulse={agent.status === "online"} size="sm" />
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{agent.type}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`${config.color} ${config.bg} border-0 text-xs`}>
                      {config.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">{agent.description}</p>

                  {/* Mini goal progress */}
                  {topGoal && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground truncate flex-1">{topGoal.text}</p>
                        <span className="text-[10px] text-muted-foreground ml-2">{Math.round(topGoal.progress * 100)}%</span>
                      </div>
                      <Progress value={topGoal.progress * 100} className="h-1" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">关联工作流</p>
                    <div className="flex flex-wrap gap-1">
                      {(agentWorkflows[agent.name] || []).map((wf) => (
                        <Badge key={wf} variant="secondary" className="text-[10px]">
                          {wf}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {agent.lastHeartbeat}
                    </span>
                    <span className="flex items-center gap-1 group-hover:text-primary transition-colors">
                      查看详情 <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </PageTransition>
  );
}
