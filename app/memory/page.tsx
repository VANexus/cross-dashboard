import { Suspense } from "react";
import { MemoryIsland } from "./islands/memory-island";

function MemorySkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton h-7 w-32" />
        <div className="skeleton h-4 w-48 mt-2" />
      </div>
      <div className="flex items-center gap-4">
        <div className="skeleton h-9 w-48" />
        <div className="skeleton h-8 w-16" />
        <div className="skeleton h-8 w-16" />
      </div>
      <div className="grid gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-2">
            <div className="skeleton h-4 w-48" />
            <div className="skeleton h-3 w-72" />
            <div className="flex gap-2">
              <div className="skeleton h-5 w-12" />
              <div className="skeleton h-5 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MemoryPage() {
  return (
    <Suspense fallback={<MemorySkeleton />}>
      <MemoryIsland />
    </Suspense>
  );
}
