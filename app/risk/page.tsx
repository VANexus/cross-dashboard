import { Suspense } from "react";
import { RiskIsland } from "./islands/risk-island";

function RiskSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton h-7 w-32" />
        <div className="skeleton h-4 w-64 mt-2" />
      </div>
      <div className="grid gap-6 grid-cols-3">
        <div className="col-span-1 rounded-xl border p-4 space-y-4">
          <div className="skeleton h-4 w-20" />
          <div className="skeleton h-24 w-24 rounded-full mx-auto" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-4 w-full" />
          ))}
        </div>
        <div className="col-span-2 rounded-xl border p-4 space-y-3">
          <div className="skeleton h-4 w-20" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-6 grid-cols-[1fr_320px]">
        <div className="rounded-xl border p-4 space-y-3">
          <div className="skeleton h-4 w-20" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-12 w-full" />
          ))}
        </div>
        <div className="rounded-xl border p-4 space-y-3">
          <div className="skeleton h-4 w-20" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="rounded-xl border p-4 space-y-3">
        <div className="skeleton h-4 w-24" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RiskPage() {
  return (
    <Suspense fallback={<RiskSkeleton />}>
      <RiskIsland />
    </Suspense>
  );
}
