"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { AiLivePanel } from "./dashboard-ai-live";

interface DashboardShellProps {
  children: React.ReactNode;
}

/** 页头（含「发起编排」按钮）+ 各 island + AI 实时编排面板 */
export function DashboardShell({ children }: DashboardShellProps) {
  const [runSignal, setRunSignal] = useState(1);

  return (
    <div className="space-y-[18px]">
      <div className="dash-pagehead">
        <div>
          <div className="dash-crumbs">
            工作台 / <b>总览</b>
          </div>
          <h1>仪表盘</h1>
          <p className="dash-desc">多智能体协同编排 · 内容工作台总览</p>
        </div>
        <div className="dash-actions">
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">实时数据 · 本地编排</span>
          <button
            type="button"
            className="btn-orchestrate"
            onClick={() => setRunSignal((n) => n + 1)}
          >
            <Sparkles className="h-4 w-4" />
            发起编排
          </button>
        </div>
      </div>

      {children}

      <AiLivePanel runSignal={runSignal} />
    </div>
  );
}
