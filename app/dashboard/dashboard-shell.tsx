"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Sparkles } from "lucide-react";
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

/** 页头（含「打开助手」按钮）+ KPI 状态条 + Agent 动态画布 */
export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  // 「打开助手」= 打开 Agent 抽屉（全站唯一 Agent 入口）
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
    state: () => ({
      kpiLoaded: statsRef.current !== null,
      canvas: usePresence.getState().canvas.map((c) => ({ id: c.id, component: c.component, title: c.title })),
    }),
    actions: agentActions,
  });

  return (
    <div className="space-y-6">
      <DashboardEntryAnim />
      <PageHeader
        breadcrumb={<><span>工作台</span> / <b>总览</b></>}
        title="仪表盘"
        description="工作流、内容与 Agent 状态的实时总览"
        actions={<>
          <span className="hidden font-mono text-caption text-muted-foreground sm:inline">实时数据</span>
          <button
            type="button"
            className="btn-orchestrate"
            data-agent-action="orchestrate"
            onClick={openOrchestrator}
            title="打开助手（Ctrl+Shift+A）"
          >
            <Sparkles className="h-4 w-4" />
            打开助手
          </button>
        </>}
      />

      {children}
    </div>
  );
}
