import { Suspense } from "react";
import { ProductResearchIsland } from "./islands/product-research-island";

function WorkflowSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg skeleton" />
        <div className="space-y-1.5">
          <div className="h-5 w-24 skeleton rounded" />
          <div className="h-3 w-64 skeleton rounded" />
        </div>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-20 skeleton rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-lg" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-40 skeleton rounded-lg" />
          <div className="h-48 skeleton rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function ProductResearchPage() {
  return (
    <Suspense fallback={<WorkflowSkeleton />}>
      <ProductResearchIsland />
    </Suspense>
  );
}
