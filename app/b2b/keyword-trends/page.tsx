import { Suspense } from "react";
import { KeywordTrendsIsland } from "./islands/keyword-trends-island";

function TrendsSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-7 space-y-4 animate-pulse">
      <div className="h-16 skeleton rounded-lg" />
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 w-24 rounded-full bg-muted" />)}
        </div>
        <div className="h-9 w-40 rounded bg-muted" />
      </div>
      <div className="rounded-lg border p-4 space-y-2">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 rounded bg-muted" />)}
      </div>
    </div>
  );
}

export default function KeywordTrendsPage() {
  return (
    <Suspense fallback={<TrendsSkeleton />}>
      <KeywordTrendsIsland />
    </Suspense>
  );
}
