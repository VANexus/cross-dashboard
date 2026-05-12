import { Suspense } from "react";
import { AiImagingIsland } from "./islands/ai-imaging-island";

function WorkflowSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg skeleton" />
        <div className="space-y-1.5">
          <div className="h-5 w-20 skeleton rounded" />
          <div className="h-3 w-72 skeleton rounded" />
        </div>
      </div>
      <div className="h-16 skeleton rounded-lg" />
      <div className="flex items-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-16 skeleton rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square skeleton rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function AiImagingPage() {
  return (
    <Suspense fallback={<WorkflowSkeleton />}>
      <AiImagingIsland />
    </Suspense>
  );
}
