import { Suspense } from "react";
import { DashboardShell } from "./dashboard-shell";
import { StatsIsland } from "./islands/stats-island";
import { DashboardCanvas, CanvasSkeleton } from "./dashboard-canvas";

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

/**
 * 仪表盘：顶部紧凑状态条（KPI / 心跳 / 告警）+ Agent 动态画布。
 * 画布内容由 Agent 经 panel.pin 按需固定，空态给引导；不预置静态面板。
 */
export default function DashboardPage() {
  return (
    <DashboardShell>
      {/* 顶部紧凑状态条（不换行、不滚动） */}
      <Suspense fallback={<StatsSkeleton />}>
        <StatsIsland compact />
      </Suspense>

      {/* Agent 动态画布：主区 = 被钉组件的渲染区 */}
      <Suspense fallback={<CanvasSkeleton />}>
        <DashboardCanvas />
      </Suspense>
    </DashboardShell>
  );
}
