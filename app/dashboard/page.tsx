import { Suspense } from "react";
import { DashboardShell } from "./dashboard-shell";
import { StatsIsland } from "./islands/stats-island";
import { WorkflowsIsland } from "./islands/workflows-island";
import { HeartbeatIsland } from "./islands/heartbeat-island";
import { AlertsIsland } from "./islands/alerts-island";
import { TrendsIsland } from "./islands/trends-island";

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

export default function DashboardPage() {
  return (
    <DashboardShell>
      <Suspense fallback={<StatsSkeleton />}>
        <StatsIsland />
      </Suspense>

      <div className="dash-grid-main">
        <Suspense fallback={<PanelSkeleton rows={6} />}>
          <WorkflowsIsland />
        </Suspense>
        <Suspense fallback={<PanelSkeleton rows={6} />}>
          <HeartbeatIsland />
        </Suspense>
      </div>

      <div className="dash-grid-sub">
        <Suspense fallback={<PanelSkeleton rows={4} />}>
          <TrendsIsland />
        </Suspense>
        <Suspense fallback={<PanelSkeleton rows={3} />}>
          <AlertsIsland />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
