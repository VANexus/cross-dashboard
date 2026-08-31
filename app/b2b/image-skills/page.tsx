import { Suspense } from "react";
import { ImageSkillsIsland } from "./islands/image-skills-island";

function SkillsSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-7 space-y-4 animate-pulse">
      <div className="h-16 skeleton rounded-lg" />
      <div className="rounded-lg border p-4 space-y-3">
        <div className="h-9 rounded bg-muted" />
        <div className="h-9 w-48 rounded bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-56 rounded-lg border bg-muted/40" />)}
      </div>
    </div>
  );
}

export default function ImageSkillsPage() {
  return (
    <Suspense fallback={<SkillsSkeleton />}>
      <ImageSkillsIsland />
    </Suspense>
  );
}
