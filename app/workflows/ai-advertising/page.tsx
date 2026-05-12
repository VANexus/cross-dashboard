import { Suspense } from "react";
import { AiAdvertisingIsland } from "./islands/ai-advertising-island";

function WorkflowSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg skeleton" />
        <div className="space-y-1.5">
          <div className="h-5 w-28 skeleton rounded" />
          <div className="h-3 w-72 skeleton rounded" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <div className="h-80 skeleton rounded-lg" />
          <div className="h-48 skeleton rounded-lg" />
        </div>
        <div className="space-y-4">
          <div className="h-64 skeleton rounded-lg" />
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 skeleton rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AiAdvertisingPage() {
  return (
    <Suspense fallback={<WorkflowSkeleton />}>
      <AiAdvertisingIsland />
    </Suspense>
  );
}
