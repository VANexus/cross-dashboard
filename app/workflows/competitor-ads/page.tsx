import { Suspense } from "react";
import { CompetitorAdsIsland } from "./islands/competitor-ads-island";

function WorkflowSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg skeleton" />
        <div className="space-y-1.5">
          <div className="h-5 w-32 skeleton rounded" />
          <div className="h-3 w-64 skeleton rounded" />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="h-64 skeleton rounded-lg" />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-48 skeleton rounded-lg" />
            <div className="h-48 skeleton rounded-lg" />
          </div>
          <div className="h-48 skeleton rounded-lg" />
        </div>
        <div className="space-y-4">
          <div className="h-64 skeleton rounded-lg" />
          <div className="h-32 skeleton rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function CompetitorAdsPage() {
  return (
    <Suspense fallback={<WorkflowSkeleton />}>
      <CompetitorAdsIsland />
    </Suspense>
  );
}
