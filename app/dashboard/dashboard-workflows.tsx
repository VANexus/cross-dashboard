"use client";

import { useCallback, useEffect, useState } from "react";
import { Workflow, Play, Radio, GitBranch } from "lucide-react";
import { sendAgentCommand } from "@/lib/agent/agent-bus";

/** /api/dashboard/workflow-status 返回的真实动态工作流 */
interface AgentWorkflow {
  id: string;
  title: string;
  goal: string;
  updated_at: string;
  stepCount: number;
  runCount: number;
  lastRunStatus: string | null;
  lastRunAt: string | null;
  lastRunSummary: string;
}
interface WfTotals {
  specCount: number;
  runCount: number;
  running: number;
  success: number;
  failed: number;
}

function shortTime(t: string | null): string {
  if (!t) return "从未运行";
  return t.slice(5, 19);
}

function statusBorder(status: string | null): string {
  if (status === "running") return "border-l-success";
  if (status === "success") return "border-l-success/70";
  if (status === "failed" || status === "error") return "border-l-destructive";
  return "border-l-foreground/15";
}

/**
 * Agent 动态工作流状态：只展示主 Agent 在对话中规划/执行的动态 SOP（真实数据，无预设）。
 * 只提供基础能力：SOP 清单 + 真实运行记录；「执行」一键交棒主 Agent（人在环中确认）。
 */
export function DashboardWorkflows() {
  const [workflows, setWorkflows] = useState<AgentWorkflow[]>([]);
  const [totals, setTotals] = useState<WfTotals>({
    specCount: 0,
    runCount: 0,
    running: 0,
    success: 0,
    failed: 0,
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/workflow-status", { cache: "no-store" });
      const json = (await res.json()) as {
        success: boolean;
        data?: { workflows: AgentWorkflow[]; totals: WfTotals };
      };
      if (json.success && json.data) {
        setWorkflows(json.data.workflows);
        setTotals(json.data.totals);
      }
    } catch {
      /* 保留上次数据 */
    }
  }, []);

  useEffect(() => {
    const t0 = window.setTimeout(load, 0);
    const t = window.setInterval(load, 10_000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(t);
    };
  }, [load]);

  return (
    <div className="glass dash-panel" data-animate="panel" suppressHydrationWarning>
      <div className="dash-panel-head">
        <span className="dash-panel-title">
          <Workflow className="h-4 w-4" /> Agent 动态工作流
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
          <Radio className="h-3 w-3 animate-pulse" /> 由对话编排
        </span>
      </div>

      {/* 紧凑统计条 */}
      <div className="mb-3 flex overflow-hidden rounded-lg border bg-surface-2">
        {[
          { key: "specCount", label: "SOP", val: totals.specCount, tone: "text-foreground" },
          { key: "runCount", label: "总运行", val: totals.runCount, tone: "text-info" },
          { key: "running", label: "运行中", val: totals.running, tone: "text-success" },
          { key: "success", label: "成功", val: totals.success, tone: "text-success" },
          { key: "failed", label: "失败", val: totals.failed, tone: "text-destructive" },
        ].map((s, i) => (
          <div
            key={s.key}
            className={`flex-1 py-2 text-center ${i < 4 ? "border-r border-border" : ""}`}
          >
            <div className={`font-mono text-[14px] font-semibold leading-none tabular-nums ${s.tone}`}>
              {s.val}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 工作流列表 */}
      <div className="space-y-0.5">
        {workflows.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            还没有 Agent 编排过工作流。去对话让主 Agent 规划一个。
          </p>
        )}
        {workflows.map((w) => (
          <div
            key={w.id}
            className={`group flex items-center gap-3 border-l-2 py-2 transition-colors hover:bg-accent-ghost ${statusBorder(w.lastRunStatus)}`}
          >
            <div className="min-w-0 flex-1 pl-2.5">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium">{w.title}</span>
                {w.lastRunStatus === "running" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-success" />
                    运行中
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <GitBranch className="h-3 w-3" />
                {w.stepCount} 步 · 运行 {w.runCount} 次 · {shortTime(w.lastRunAt)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => sendAgentCommand(`执行工作流 ${w.id}（${w.title}）并按步骤汇报结果`)}
              className="mr-3 inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              title="让主 Agent 执行该动态工作流"
            >
              <Play className="h-3 w-3" /> 执行
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
