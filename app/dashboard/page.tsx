import { Suspense } from "react";
import { DashboardShell } from "./dashboard-shell";
import { StatsIsland } from "./islands/stats-island";
import { WorkflowsIsland } from "./islands/workflows-island";
import { HeartbeatIsland } from "./islands/heartbeat-island";
import { TopologyIsland } from "./islands/topology-island";
import { WorkflowTopologyIsland } from "./islands/workflow-topology-island";
import { AiLivePanel } from "./dashboard-ai-live";

function StatsSkeleton() {
  return (
    <div className="dash-kpi-grid">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass dash-kpi">
          <div className="skeleton h-3 w-16" />
          <div className="skeleton h-7 w-24 mt-3" />
          <div className="skeleton h-2 w-20 mt-3" />
        </div>
      ))}
    </div>
  );
}

function PanelSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="glass dash-panel space-y-3">
      <div className="skeleton h-4 w-32" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-10 w-full" />
      ))}
    </div>
  );
}

/**
 * AI-Native 单屏指挥台：整页不滚动。
 * 进入页面即自动展开右侧 Copilot 抽屉（对话即主操作台）——
 * 右侧抽屉承载全部 AI 对话/编排，主区只保留「关键状态」：
 *   协同拓扑（旋转/拖拽）+ 动态工作流 DAG + Agent 心跳 + 实时任务流。
 * 其余原子能力（能力中心/趋势/告警等）由 Agent 在对话中按需生成组件展示，
 * 不再堆砌面板——琳琅满目的组件由 Agent 组装，而非把 UI 做琳琅满目。
 */
export default function DashboardPage() {
  return (
    <DashboardShell cockpit>
      {/* 顶部紧凑 KPI 单行（不换行、不滚动） */}
      <Suspense fallback={<StatsSkeleton />}>
        <div className="cockpit-kpi">
          <StatsIsland compact />
        </div>
      </Suspense>

      <div className="cockpit-grid">
        {/* A1 协同拓扑：Agent 拓扑（旋转/拖拽）—— 全宽主视觉 */}
        <div className="cockpit-panel cockpit-span-3">
          <Suspense fallback={<PanelSkeleton rows={4} />}>
            <TopologyIsland />
          </Suspense>
        </div>

        {/* A2 动态工作流 DAG：Agent 实时编排的可视化 */}
        <div className="cockpit-panel">
          <Suspense fallback={<PanelSkeleton rows={4} />}>
            <WorkflowTopologyIsland />
          </Suspense>
        </div>

        {/* A3 Agent 动态工作流：真实 SOP + 运行记录 */}
        <div className="cockpit-panel">
          <Suspense fallback={<PanelSkeleton rows={5} />}>
            <WorkflowsIsland />
          </Suspense>
        </div>

        {/* A4 Agent 心跳：真实活动/情绪 */}
        <div className="cockpit-panel">
          <Suspense fallback={<PanelSkeleton rows={6} />}>
            <HeartbeatIsland />
          </Suspense>
        </div>

        {/* A5 AI 实时任务流 */}
        <div className="cockpit-panel">
          <Suspense fallback={<PanelSkeleton rows={4} />}>
            <AiLivePanel />
          </Suspense>
        </div>
      </div>
    </DashboardShell>
  );
}
