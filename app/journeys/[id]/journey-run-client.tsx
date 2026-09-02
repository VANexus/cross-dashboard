"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Edge,
  Node,
  NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { ArrowLeft, ArrowRight, CirclePlay, Compass, MapPinCheckInside } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { WorkflowStepper, type StepItem } from "@/components/ui/workflow-stepper";
import { TeamSopPanel } from "@/components/journey/team-sop-panel";
import { useAgentPage } from "@/lib/agent/page-context";
import { getJourneyById } from "@/lib/journeys/registry";
import { useJourneyRun } from "@/stores/journey-run";
import { toast } from "sonner";

/** xyflow 自定义节点：旅程步骤 */
type JourneyNodeData = { label: string; index: number; active: boolean; done: boolean };
function JourneyNode({ data }: NodeProps) {
  const d = data as unknown as JourneyNodeData;
  return (
    <div
      className={`
        rounded-lg border px-3 py-2 text-xs shadow-sm min-w-[140px]
        ${d.done ? "border-success/40 bg-success/5" : ""}
        ${d.active ? "border-primary bg-primary/10 text-primary font-medium" : ""}
        ${!d.active && !d.done ? "border-border bg-card text-muted-foreground" : ""}
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-border" />
      <div className="flex items-center gap-2">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 font-mono text-tiny">
          {d.index}
        </span>
        {d.label}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-border" />
    </div>
  );
}

const nodeTypes = { journey: JourneyNode };

export function JourneyRunClient({ journeyId }: { journeyId: string }) {
  const router = useRouter();
  const journey = getJourneyById(journeyId);
  const run = useJourneyRun();
  const detailRef = useRef<HTMLDivElement>(null);

  const isMine = run.journeyId === journeyId;
  const currentIdx = isMine ? Math.max(0, run.currentStep - 1) : 0;

  useAgentPage({
    route: `/journeys/${journeyId}`,
    title: journey ? `旅程执行 · ${journey.label}` : "旅程执行",
    snapshot: () => {
      if (!journey) return "旅程不存在";
      const steps = journey.steps
        .map((s, i) => `${i + 1}.${s.label}${isMine && i < run.currentStep - 1 ? "（已完成）" : isMine && i === currentIdx ? "（当前）" : ""}`)
        .join(" → ");
      return `旅程「${journey.label}」共 ${journey.steps.length} 步：${steps}。${isMine ? `当前第 ${run.currentStep} 步。` : "尚未发起，可用 startJourney 发起。"}`;
    },
    state: () => ({ journeyId, currentStep: isMine ? run.currentStep : 0 }),
  });

  const { nodes, edges } = useMemo(() => {
    if (!journey) return { nodes: [] as Node[], edges: [] as Edge[] };
    const nodes: Node[] = journey.steps.map((s, i) => ({
      id: s.id,
      type: "journey",
      position: { x: 20, y: i * 76 },
      data: {
        label: s.label,
        index: i + 1,
        active: isMine && i === currentIdx,
        done: isMine && i < run.currentStep - 1,
      } satisfies JourneyNodeData,
      draggable: false,
    }));
    const edges: Edge[] = journey.steps.slice(1).map((s, i) => ({
      id: `${journey.steps[i].id}-${s.id}`,
      source: journey.steps[i].id,
      target: s.id,
      animated: isMine && i === currentIdx - 1,
    }));
    return { nodes, edges };
  }, [journey, isMine, currentIdx, run.currentStep]);

  if (!journey) {
    return (
      <div className="min-h-screen bg-surface-0">
        <div className="mx-auto max-w-3xl py-10 text-center">
          <p className="text-muted-foreground">旅程「{journeyId}」未登记。</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/journeys">返回编排中心</Link>
          </Button>
        </div>
      </div>
    );
  }

  const stepperItems: StepItem[] = journey.steps.map((s, i) => ({
    id: s.id,
    label: s.label,
    description: s.description,
    status: isMine && i < currentIdx ? "completed" : isMine && i === currentIdx ? "active" : "pending",
  }));

  const currentStep = journey.steps[currentIdx];
  const nextStep = journey.steps[currentIdx + 1];

  const handleStart = () => {
    run.start(journeyId);
    toast.success(`已发起「${journey.label}」`, { description: "从第 1 步开始执行" });
  };

  const handleAdvance = () => {
    if (!isMine) return;
    run.markStepDone(currentStep.id);
    if (nextStep) {
      run.advance(journey.steps.length);
      router.push(nextStep.href);
      toast.success(`第 ${currentIdx + 1} 步完成`, { description: `前往下一步：${nextStep.label}` });
    } else {
      run.advance(journey.steps.length);
      toast.success("旅程全部步骤已执行完毕", { description: "可在编排中心发起新旅程" });
    }
  };

  const handleTour = () => {
    const driverObj = driver({
      showProgress: true,
      steps: journey.steps.map((s, i) => ({
        element: `#journey-step-${s.id}`,
        popover: {
          title: `第 ${i + 1} 步 · ${s.label}`,
          description: s.description,
        },
      })),
    });
    driverObj.drive();
  };

  return (
    <div>
      <div>
        {/* 页头 */}
        <PageHeader
          breadcrumb={<Link href="/journeys" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-3 w-3" /> 流程编排中心</Link>}
          title={<span className="flex items-center gap-2.5">
            {(() => {
              const Icon = journey.icon;
              return <Icon className="h-6 w-6 text-primary" />;
            })()}
            {journey.label}
          </span>}
          description={journey.description}
          actions={<>
            {!journey.enabled ? (
              <Badge variant="secondary">骨架旅程 · 未开放执行</Badge>
            ) : isMine ? (
              <Badge>进行中 · 第 {run.currentStep}/{journey.steps.length} 步</Badge>
            ) : (
              <Button size="sm" onClick={handleStart} data-agent-action={`journey-start-${journeyId}`}>
                <CirclePlay className="h-3.5 w-3.5" />
                发起旅程
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleTour}>
              <Compass className="h-3.5 w-3.5" />
              新手引导
            </Button>
          </>}
        />

        {/* Linear 式可拖拽分栏：管线图 ｜ 步骤详情（react-resizable-panels，键盘可调） */}
        <ResizablePanelGroup
          orientation="horizontal"
          className="mt-8 min-h-[420px] gap-0 rounded-lg"
        >
          {/* 左：xyflow 管线图 */}
          <ResizablePanel defaultSize={24} minSize={16} maxSize={40}>
            <Card className="workflow-card h-full py-0">
              <CardContent className="p-3">
                <p className="px-1 pb-2 text-caption font-medium uppercase tracking-widest text-muted-foreground/60">
                  旅程管线
                </p>
                <div className="h-[300px]">
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                    proOptions={{ hideAttribution: true }}
                    nodesConnectable={false}
                    elementsSelectable={false}
                    zoomOnScroll={false}
                    panOnScroll={false}
                  >
                    <Background variant={BackgroundVariant.Dots} gap={14} size={1} />
                  </ReactFlow>
                </div>
              </CardContent>
            </Card>
          </ResizablePanel>

          <ResizableHandle withHandle className="mx-3" />

          {/* 右：步骤列表 + 当前步详情 */}
          <ResizablePanel defaultSize={76}>
            <div className="space-y-5">
              <Card className="workflow-card py-0" ref={undefined}>
                <CardContent className="p-5">
                  <WorkflowStepper
                    steps={stepperItems.map((s, i) => ({ ...s, "data-step-anchor": journey.steps[i].id }))}
                    currentStep={isMine ? journey.steps[currentIdx]?.id ?? "" : ""}
                  />
                </CardContent>
              </Card>

              {journey.enabled && currentStep && (
                <Card className="workflow-card py-0" data-tour="current-step">
                  <CardContent className="p-5" ref={detailRef}>
                    <div className="flex items-center gap-2.5" id={`journey-step-${currentStep.id}`}>
                      <MapPinCheckInside className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">
                        当前步骤 · 第 {currentIdx + 1} 步 {currentStep.label}
                      </span>
                      {isMine && <Badge variant="secondary" className="ml-auto">active</Badge>}
                    </div>
                    <p className="mt-2.5 text-body text-muted-foreground">{currentStep.description}</p>
                    {currentStep.agentHint && (
                      <p className="mt-2 rounded-md bg-surface-2 px-3 py-2 font-mono text-caption text-muted-foreground">
                        Agent 提示：{currentStep.agentHint}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-2.5">
                      <Button asChild size="sm" data-agent-action="journey-goto">
                        <Link href={currentStep.href}>
                          前往执行 <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      {isMine && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleAdvance}
                          data-agent-action="journey-next"
                        >
                          {nextStep ? "标记完成 · 下一步" : "标记完成 · 结束旅程"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* M4：把当前旅程保存为团队 SOP / 查看与重跑已保存 SOP */}
        {journey.enabled && <TeamSopPanel journeyId={journeyId} />}
      </div>
    </div>
  );
}
