import { Suspense } from "react";
import { InventoryIsland } from "./islands/inventory-island";

function WorkflowSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg skeleton" />
        <div className="space-y-1.5">
          <div className="h-5 w-24 skeleton rounded" />
          <div className="h-3 w-72 skeleton rounded" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-9 flex-1 max-w-sm skeleton rounded-lg" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-7 w-14 skeleton rounded-lg" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="h-96 skeleton rounded-lg" />
        <div className="space-y-4">
          <div className="h-32 skeleton rounded-lg" />
          <div className="h-48 skeleton rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<WorkflowSkeleton />}>
      <InventoryIsland />
    </Suspense>
  );
}
