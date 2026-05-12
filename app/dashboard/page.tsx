import { Suspense } from "react";
import { StatsIsland } from "./islands/stats-island";
import { WorkflowsIsland } from "./islands/workflows-island";
import { HeartbeatIsland } from "./islands/heartbeat-island";
import { AlertsIsland } from "./islands/alerts-island";
import { TrendsIsland } from "./islands/trends-island";

function StatsSkeleton() {
  return (
    <div className="data-grid grid-cols-2 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1 p-4">
          <div className="skeleton h-3 w-16" />
          <div className="skeleton h-7 w-20 mt-1" />
          <div className="skeleton h-2 w-12" />
        </div>
      ))}
    </div>
  );
}

function WorkflowsSkeleton() {
  return (
    <div className="lg:col-span-3 rounded-xl border p-4 space-y-3">
      <div className="skeleton h-4 w-32" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton h-10 w-full" />
      ))}
    </div>
  );
}

function HeartbeatSkeleton() {
  return (
    <div className="lg:col-span-2 rounded-xl border p-4 space-y-3">
      <div className="skeleton h-4 w-24" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton h-8 w-full" />
      ))}
    </div>
  );
}

function AlertsSkeleton() {
  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="skeleton h-4 w-20" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton h-10 w-full" />
      ))}
    </div>
  );
}

function TrendsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border p-4 space-y-2">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-7 w-24" />
          <div className="skeleton h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<StatsSkeleton />}>
        <StatsIsland />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-5">
        <Suspense fallback={<WorkflowsSkeleton />}>
          <WorkflowsIsland />
        </Suspense>
        <Suspense fallback={<HeartbeatSkeleton />}>
          <HeartbeatIsland />
        </Suspense>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Suspense fallback={<AlertsSkeleton />}>
          <AlertsIsland />
        </Suspense>
      </div>

      <Suspense fallback={<TrendsSkeleton />}>
        <TrendsIsland />
      </Suspense>
    </div>
  );
}
