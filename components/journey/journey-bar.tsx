"use client";

/**
 * JourneyBar — 页面顶部旅程步进条（跨页流转的统一把手）
 *
 * 用法：页面里放一行 `<JourneyBar />` 即可。
 * - 仅当 URL 带 `?journey=<id>&step=<n>` 且该旅程正在运行时才渲染（零侵入）
 * - step 为旅程 manifest 中第 n 步（1-based）
 * - 「标记完成 · 下一步」推进 useJourneyRun 并跳转下一步 href（与 journey-run-client、
 *   全局动作 advanceJourney 同一逻辑），Agent 可经 data-agent-action="journey-next" 驱动
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Route, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WorkflowStepper } from "@/components/ui/workflow-stepper";
import { getJourneyById } from "@/lib/journeys/registry";
import { useJourneyRun } from "@/stores/journey-run";

export function JourneyBar() {
  // 自带 Suspense 边界（useSearchParams 要求），宿主页无需额外包裹
  return (
    <Suspense fallback={null}>
      <JourneyBarInner />
    </Suspense>
  );
}

function JourneyBarInner() {
  const router = useRouter();
  const params = useSearchParams();
  const runJourneyId = useJourneyRun((s) => s.journeyId);
  const markStepDone = useJourneyRun((s) => s.markStepDone);
  const advanceRun = useJourneyRun((s) => s.advance);
  const resetRun = useJourneyRun((s) => s.reset);

  const journeyId = params.get("journey");
  const stepNum = Number(params.get("step") ?? "0");
  const journey = journeyId ? getJourneyById(journeyId) : undefined;

  if (!journey || !journey.enabled || stepNum < 1 || stepNum > journey.steps.length) return null;
  if (runJourneyId !== journey.id) return null;

  const idx = stepNum - 1;
  const current = journey.steps[idx];
  const next = journey.steps[idx + 1];

  const stepperItems = journey.steps.map((s, i) => ({
    id: s.id,
    label: s.label,
    status:
      i < idx ? ("completed" as const)
        : i === idx ? ("active" as const)
          : ("pending" as const),
  }));

  const advance = () => {
    markStepDone(current.id);
    if (next) {
      advanceRun(journey.steps.length);
      router.push(next.href);
      toast.success(`第 ${idx + 1} 步「${current.label}」完成`, {
        description: `前往下一步：${next.label}`,
      });
    } else {
      advanceRun(journey.steps.length);
      toast.success(`旅程「${journey.label}」全部完成`, {
        description: "可在流程编排中心发起新旅程",
      });
    }
  };

  const exit = () => {
    resetRun();
    router.push("/journeys");
    toast("已退出旅程");
  };

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-surface-1 px-3.5 py-2"
      data-journey-bar={journey.id}
    >
      <Link
        href={`/journeys/${journey.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        title="打开旅程执行视图"
      >
        <Route className="h-3.5 w-3.5" />
        {journey.label}
      </Link>
      <div className="hidden lg:block">
        <WorkflowStepper
          steps={stepperItems}
          currentStep={current.id}
          orientation="horizontal"
          compact
          onStepClick={(id) => {
            const target = journey.steps.find((s) => s.id === id);
            if (target) router.push(target.href);
          }}
        />
      </div>
      <span className="text-xs text-muted-foreground lg:hidden">
        第 {idx + 1}/{journey.steps.length} 步 · {current.label}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <Button size="sm" className="h-7 px-3 text-xs" onClick={advance} data-agent-action="journey-next">
          {next ? "标记完成 · 下一步" : "标记完成 · 结束旅程"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 px-0 text-muted-foreground"
          onClick={exit}
          title="退出旅程"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
