import { Suspense } from "react";
import { CreationsClient } from "./creations-client";

export default function CreationsPage() {
  return (
    <Suspense fallback={<CreationsSkeleton />}>
      <CreationsClient />
    </Suspense>
  );
}

function CreationsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-48 skeleton rounded" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-lg skeleton" />
        ))}
      </div>
    </div>
  );
}