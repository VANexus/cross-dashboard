import { Suspense } from "react";
import { ListingIsland } from "./islands/listing-island";

function ListingSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-7 space-y-4 animate-pulse">
      <div className="h-16 skeleton rounded-lg" />
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 w-24 rounded-full bg-muted" />)}
        </div>
        <div className="h-9 w-48 rounded bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-44 rounded-lg border bg-muted/40" />)}
      </div>
      <div className="rounded-lg border p-4 space-y-2">
        {[1, 2].map((i) => <div key={i} className="h-14 rounded bg-muted" />)}
      </div>
    </div>
  );
}

export default function ListingPage() {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <ListingIsland />
    </Suspense>
  );
}
