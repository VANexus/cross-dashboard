import { Suspense } from "react";
import { EvolutionIsland } from "./islands/evolution-island";

function EvolutionSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton h-7 w-20" />
        <div className="skeleton h-4 w-48 mt-2" />
      </div>
      <div className="flex items-center gap-4">
        <div className="skeleton h-9 w-48" />
        <div className="skeleton h-8 w-16" />
        <div className="skeleton h-8 w-16" />
      </div>
      <div className="grid gap-4 grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
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
      <div className="rounded-xl border p-4 space-y-3">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-24 w-full" />
      </div>
    </div>
  );
}

export default function EvolutionPage() {
  return (
    <Suspense fallback={<EvolutionSkeleton />}>
      <EvolutionIsland />
    </Suspense>
  );
}
