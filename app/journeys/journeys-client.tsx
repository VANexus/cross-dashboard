"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ArrowRight, CirclePlay, Lock, Route, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAgentPage } from "@/lib/agent/page-context";
import { journeys as allJourneys } from "@/lib/journeys/registry";
import { sortedWorkspaces } from "@/lib/workspaces/registry";
import { useJourneyRun } from "@/stores/journey-run";
import { toast } from "sonner";

/** 步骤迷你条：数字节点 + 连线（编排卡片内） */
function StepStrip({ steps }: { steps: { id: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {steps.map((s, i) => (
        <span key={s.id} className="inline-flex items-center gap-1.5">
          {i > 0 && <span className="h-px w-4 bg-border" aria-hidden />}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-caption text-muted-foreground">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 font-mono text-tiny text-primary">
              {i + 1}
            </span>
            {s.label}
          </span>
        </span>
      ))}
    </div>
  );
}

export function JourneysClient() {
  const run = useJourneyRun();
  const gridRef = useRef<HTMLDivElement>(null);

  useAgentPage({
    title: "流程编排中心",
    snapshot: () => {
      const enabled = allJourneys.filter((j) => j.enabled);
      return (
        `已登记旅程 ${allJourneys.length} 条（可用 ${enabled.length} 条），` +
        `空间 ${sortedWorkspaces.length} 个。` +
        (run.journeyId
          ? `进行中：${run.journeyId}（第 ${run.currentStep} 步）`
          : "当前无进行中旅程。可用动作 startJourney 发起。")
      );
    },
    state: () => ({ journeyId: run.journeyId, currentStep: run.currentStep }),
  });

  // GSAP 入场 stagger（Linear 式克制：位移 10px + 透明度）
  useEffect(() => {
    if (gridRef.current) {
      gsap.fromTo(
        gridRef.current.querySelectorAll("[data-journey-card]"),
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.45, ease: "power3.out", stagger: 0.06, clearProps: "all" },
      );
    }
  }, []);

  const enabled = allJourneys.filter((j) => j.enabled);
  const skeletons = allJourneys.filter((j) => !j.enabled);

  const handleStart = (id: string) => {
    run.start(id);
    toast.success("旅程已发起", { description: "第一步已就绪，点击卡片前往执行" });
  };

  return (
    <div>
      <div>
        {/* 页头 */}
        <PageHeader
          breadcrumb={<><span>FlowMind</span> / <b>流程编排中心</b></>}
          title="流程编排中心"
          description="以端到端业务旅程为主线，串联全部工作流空间——发起后按步骤流转，Agent 全程伴随。"
          icon={<Route className="h-6 w-6 text-primary" />}
          actions={<Badge variant="secondary" className="gap-1.5">
            <Sparkles className="h-3 w-3" />
            {sortedWorkspaces.length} 个空间已接入
          </Badge>}
        />

        {/* 可用旅程（bento） */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-muted-foreground">可用旅程</h2>
          <div ref={gridRef} className="mt-4 grid gap-5 md:grid-cols-2">
            {enabled.map((j) => {
              const Icon = j.icon;
              const isRunning = run.journeyId === j.id;
              const doneCount = isRunning ? run.completedSteps.length : 0;
              return (
                <Card
                  key={j.id}
                  data-journey-card
                  data-journey-id={j.id}
                  className="workflow-card relative overflow-hidden py-0"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-4.5 w-4.5 text-primary" />
                      </div>
                      {isRunning ? (
                        <Badge>进行中 · 第 {run.currentStep}/{j.steps.length} 步</Badge>
                      ) : (
                        <Badge variant="secondary">{j.steps.length} 步</Badge>
                      )}
                    </div>
                    <CardTitle className="mt-3 text-base">{j.label}</CardTitle>
                    <CardDescription>{j.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-5">
                    <StepStrip steps={j.steps.map((s) => ({ id: s.id, label: s.label }))} />
                    {isRunning && (
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${(doneCount / j.steps.length) * 100}%` }}
                        />
                      </div>
                    )}
                    <div className="mt-4 flex items-center gap-2.5">
                      {isRunning ? (
                        <Button asChild size="sm" data-agent-action={`journey-continue-${j.id}`}>
                          <Link href={`/journeys/${j.id}`}>
                            继续旅程 <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          data-agent-action={`journey-start-${j.id}`}
                          onClick={() => handleStart(j.id)}
                        >
                          <CirclePlay className="h-3.5 w-3.5" />
                          发起旅程
                        </Button>
                      )}
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/journeys/${j.id}`}>查看路线</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* 骨架旅程 */}
        {skeletons.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold text-muted-foreground">规划中（骨架已登记，随插件接入点亮）</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {skeletons.map((j) => {
                const Icon = j.icon;
                return (
                  <Card
                    key={j.id}
                    data-journey-card
                    className="workflow-card py-0 opacity-70 transition-opacity hover:opacity-100"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-body font-medium">{j.label}</span>
                        <Lock className="ml-auto h-3 w-3 text-muted-foreground/50" />
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{j.description}</p>
                      <StepStrip steps={j.steps.map((s) => ({ id: s.id, label: s.label }))} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
