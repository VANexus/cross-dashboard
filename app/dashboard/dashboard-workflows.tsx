"use client";

import { Workflow, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DonutChart } from "@/components/ui/donut-chart";
import type { WorkflowStatus } from "@/lib/types";

interface DashboardWorkflowsProps {
  workflows: WorkflowStatus[];
}

const railColors: Record<string, string> = {
  "video-localization": "var(--info)",
  copywriting: "var(--primary)",
  "compliance-audit": "var(--success)",
  "image-gen": "var(--wf-imaging)",
  "idea-design": "var(--wf-product)",
  "hot-topic": "var(--warning)",
};

const statusSlice = [
  { key: "running", label: "运行中", color: "var(--success)" },
  { key: "warning", label: "需关注", color: "var(--warning)" },
  { key: "idle", label: "空闲", color: "var(--muted-foreground)" },
] as const;

function toneOf(status: string): "ok" | "warn" | "muted" {
  if (status === "running") return "ok";
  if (status === "warning") return "warn";
  return "muted";
}

function dotClass(status: string): string {
  return status === "running" ? "dash-dot ok" : status === "warning" ? "dash-dot warn" : "dash-dot idle";
}

export function DashboardWorkflows({ workflows }: DashboardWorkflowsProps) {
  const counts = statusSlice.map((s) => ({
    label: s.label,
    color: s.color,
    value: workflows.filter((w) => w.status === s.key).length,
  }));

  return (
    <div className="glass dash-panel">
      <div className="dash-panel-head">
        <span className="dash-panel-title">
          <Workflow className="h-4 w-4" /> 工作流状态
        </span>
        <Link href="/content-studio" className="dash-panel-more">
          查看全部 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mb-4 flex items-center gap-5">
        <DonutChart
          data={counts}
          centerValue={String(workflows.length)}
          centerLabel="工作流"
          size={132}
          thickness={14}
        />
        <div className="flex flex-1 flex-col gap-2">
          {counts.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <i className="h-2 w-2 rounded-xs" style={{ background: s.color }} />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="metric-value ml-auto">{s.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="divide-y divide-transparent">
        {workflows.map((w) => {
          const tone = toneOf(w.status);
          return (
            <Link
              key={w.id}
              href={w.href}
              className="dash-wf-row"
            >
              <span className="dash-wf-rail" style={{ background: railColors[w.id] ?? "var(--primary)" }} />
              <span className={dotClass(w.status)} />
              <div className="min-w-0">
                <div className="dash-wf-name truncate">{w.name}</div>
                <div className="dash-wf-meta flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {w.lastRun || "尚未运行"} · {w.runs} 次
                </div>
              </div>
              <div className="dash-wf-right">
                <div className={cn("dash-wf-pct", tone)}>{w.success}%</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
