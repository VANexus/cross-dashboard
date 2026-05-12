import { Suspense } from "react";
import { AgentsIsland } from "./islands/agents-island";

function AgentsSkeleton() {
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
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="skeleton h-10 w-10 rounded-full" />
              <div className="space-y-1">
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-3 w-16" />
              </div>
            </div>
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  return (
    <Suspense fallback={<AgentsSkeleton />}>
      <AgentsIsland />
    </Suspense>
  );
}
