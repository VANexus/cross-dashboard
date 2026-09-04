"use client";

import { useEffect, useRef, useState } from "react";
import { GitBranch, RefreshCw, Loader2, Workflow as WorkflowIcon } from "lucide-react";

export interface WorkflowTopoNode {
  id: string;
  tool: string;
  dependsOn?: string[];
}

export interface WorkflowTopo {
  id: string;
  title: string;
  goal: string;
  updated_at: string;
  steps: WorkflowTopoNode[];
}

const TOOL_COLOR: Record<string, string> = {
  ad_analyze: "var(--wf-ad)",
  ad_optimize: "var(--wf-ad)",
  ad_keywords: "var(--wf-ad)",
  product_research: "var(--wf-product)",
  imaging_generate: "var(--wf-imaging)",
  listing_generate: "var(--wf-listing)",
  inventory_restock: "var(--wf-inventory)",
  competitor_analyze: "var(--wf-competitor)",
  memory_search: "var(--info)",
  memory_store: "var(--info)",
};

function toolColor(tool: string): string {
  if (TOOL_COLOR[tool]) return TOOL_COLOR[tool];
  let h = 0;
  for (let i = 0; i < tool.length; i++) h = (h * 31 + tool.charCodeAt(i)) % 360;
  return `hsl(${h} 65% 55%)`;
}

function isEntry(steps: WorkflowTopoNode[], step: WorkflowTopoNode): boolean {
  return !step.dependsOn || step.dependsOn.length === 0;
}

export function WorkflowTopology() {
  const [data, setData] = useState<WorkflowTopo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<number | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/dashboard/workflow-topology");
      const json = await res.json();
      if (json.data) setData(json.data);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    timer.current = window.setInterval(() => void load(), 10000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  return (
    <div className="glass dash-panel" data-animate="panel" suppressHydrationWarning>
      <div className="dash-panel-head">
        <span className="dash-panel-title">
          <WorkflowIcon className="h-4 w-4" /> 动态工作流可视化
        </span>
        <button
          className="dash-panel-more inline-flex items-center gap-1"
          onClick={() => {
            setLoading(true);
            void load();
          }}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          刷新
        </button>
      </div>

      {loading && data === null ? (
        <div className="space-y-2 py-2">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-24 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-xl border border-dashed py-10 text-center">
          <GitBranch className="mx-auto h-6 w-6 text-muted-foreground/50" />
          <p className="mt-2 text-xs text-muted-foreground">
            暂无动态工作流。在对话面板输入「规划一个 xx 工作流」，主 Agent 会动态编排 SOP 并在此可视化
          </p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2">
          {data.map((wf) => {
            const entries = wf.steps.filter((s) => isEntry(wf.steps, s));
            return (
              <div key={wf.id} className="rounded-xl border border-border bg-card/60 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium truncate" title={wf.title}>
                    {wf.title}
                  </p>
                  <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 font-mono text-tiny text-muted-foreground">
                    {wf.steps.length} 步
                  </span>
                </div>
                <p className="mb-2 text-tiny text-muted-foreground line-clamp-1" title={wf.goal}>
                  {wf.goal}
                </p>
                <div className="space-y-0">
                  {wf.steps.map((step, idx) => {
                    const isRoot = entries.includes(step);
                    return (
                      <div key={step.id} className="relative">
                        {idx < wf.steps.length - 1 && (
                          <div className="absolute left-[13px] top-6 bottom-[-8px] w-px bg-border" />
                        )}
                        <div className="relative flex items-center gap-2 py-1">
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-tiny font-mono"
                            style={{ borderColor: toolColor(step.tool), color: toolColor(step.tool) }}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-tiny font-medium" title={step.id}>
                              {step.id}
                            </p>
                            <p className="truncate text-tiny text-muted-foreground font-mono">{step.tool}</p>
                          </div>
                          {isRoot ? (
                            <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-tiny text-primary">
                              起点
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-tiny text-muted-foreground">
                              依赖 {step.dependsOn?.length ?? 0}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
