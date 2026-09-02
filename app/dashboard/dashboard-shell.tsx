"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { AiLivePanel } from "./dashboard-ai-live";
import { useDataChanged } from "@/hooks/use-data-changed";
import { usePresence } from "@/stores/agent-presence";
import { useAgentPage } from "@/lib/agent/page-context";
import { runHighlight } from "@/lib/agent/ui-actions";
import type { UIActionDef } from "@/lib/agent/ui-actions";
import type { DashboardStats } from "@/lib/types";

interface DashboardShellProps {
  children: React.ReactNode;
}

/** 页头（含「发起编排」按钮）+ 各 island + AI 实时任务流 */
export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  // 「发起编排」= 打开 Agent 抽屉（全站唯一 Agent 入口，旧编排面板已删除）
  const openOrchestrator = () => usePresence.getState().setDrawerOpen(true);

  // 全站数据联动：编排工具执行 / 产物转化落库后，防抖刷新所有 server islands
  useDataChanged(() => router.refresh());

  // 「页面即上下文」：KPI 数据供 snapshot/readKpi 读取（挂载拉取，ref 保持最新）
  const statsRef = useRef<DashboardStats | null>(null);
  const fetchStats = async (): Promise<DashboardStats | null> => {
    try {
      const res = await fetch("/api/dashboard");
      const json = (await res.json()) as { success: boolean; data?: { stats?: DashboardStats } };
      statsRef.current = json.data?.stats ?? null;
      return statsRef.current;
    } catch {
      return null;
    }
  };
  useEffect(() => {
    void fetchStats();
  }, []);

  const agentActions: UIActionDef[] = [
    {
      id: "readKpi",
      description: "读取仪表盘 KPI 数据（工作流/Agent/任务/风险事件统计）并汇总",
      schema: z.object({}),
      execute: async () => {
        const s = await fetchStats();
        if (!s) return "KPI 读取失败：/api/dashboard 不可达";
        return (
          `KPI：工作流运行 ${s.runningTasks}/${s.totalTasks}，已完成 ${s.completedTasks}` +
          `${s.failedTasks ? `，失败 ${s.failedTasks}` : ""}；Agent 在线 ${s.onlineAgents}/${s.totalAgents}` +
          `${s.busyAgents ? `，忙碌 ${s.busyAgents}` : ""}；24h 风险事件 ${s.riskEvents24h} 起` +
          `${s.activeCircuitBreakers ? `，熔断中 ${s.activeCircuitBreakers} 个` : ""}`
        );
      },
    },
    {
      id: "focusCard",
      description:
        "高亮指定的 KPI 卡片（cardId：workflows=运行中工作流 / agents=在线 Agent / tasks=已完成任务 / risk=风险事件）",
      schema: z.object({ cardId: z.string().min(1) }),
      execute: (p) => runHighlight(`[data-agent-card="${String(p.cardId)}"]`),
    },
    {
      id: "openTrends",
      description: "打开 B 端关键词趋势页（/b2b/keyword-trends）",
      schema: z.object({}),
      execute: () => {
        router.push("/b2b/keyword-trends");
        return "已打开关键词趋势页";
      },
    },
  ];

  useAgentPage({
    title: "运营总览",
    snapshot: () => {
      const s = statsRef.current;
      if (!s) return "KPI 尚未加载完成（可调用 readKpi 动作获取）";
      return (
        `今日 KPI：工作流运行 ${s.runningTasks}/${s.totalTasks} · 已完成 ${s.completedTasks}` +
        `${s.failedTasks ? ` · 失败 ${s.failedTasks}` : ""} · Agent 在线 ${s.onlineAgents}/${s.totalAgents}` +
        ` · 24h 风险事件 ${s.riskEvents24h} 起`
      );
    },
    state: () => ({ kpiLoaded: statsRef.current !== null }),
    actions: agentActions,
  });

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
            data-agent-action="orchestrate"
            onClick={openOrchestrator}
            title="打开 AI 编排助手（Ctrl+Shift+A）"
          >
            <Sparkles className="h-4 w-4" />
            发起编排
          </button>
        </div>
      </div>

      {children}

      <AiLivePanel />
    </div>
  );
}
