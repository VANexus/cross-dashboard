import { Suspense } from "react";
import { ContentStudioIsland } from "./islands/content-studio-island";

function ContentSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg skeleton" />
        <div className="space-y-1.5">
          <div className="h-5 w-24 skeleton rounded" />
          <div className="h-3 w-72 skeleton rounded" />
        </div>
      </div>
      <div className="h-24 skeleton rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 skeleton rounded-lg" />
        <div className="h-40 skeleton rounded-lg" />
      </div>
      <div className="h-64 skeleton rounded-lg" />
    </div>
  );
}

export default function ContentStudioPage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <ContentStudioIsland />
    </Suspense>
  );
}
