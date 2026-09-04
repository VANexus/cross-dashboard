"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useDataChanged } from "@/hooks/use-data-changed";
import { usePresence } from "@/stores/agent-presence";
import { useAgentPage } from "@/lib/agent/page-context";
import { runHighlight } from "@/lib/agent/ui-actions";
import { DashboardEntryAnim } from "./dashboard-entry-anim";
import type { UIActionDef } from "@/lib/agent/ui-actions";
import type { DashboardStats } from "@/lib/shared/types";

interface DashboardShellProps {
  children: React.ReactNode;
}

/** 沉浸式对话画布壳：页头（无按钮，入口仅 dock）+ KPI 状态条 + 中心对话（满高 flex 列） */
export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();

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
    state: () => ({
      kpiLoaded: statsRef.current !== null,
      canvas: usePresence.getState().canvas.map((c) => ({ id: c.id, component: c.component, title: c.title })),
    }),
    actions: agentActions,
  });

  return (
    <div className="flex flex-col gap-3">
      <DashboardEntryAnim />
      {children}
    </div>
  );
}
