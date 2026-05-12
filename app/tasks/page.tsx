import { Suspense } from "react";
import { TasksIsland } from "./islands/tasks-island";

function TasksSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton h-7 w-32" />
        <div className="skeleton h-4 w-64 mt-2" />
      </div>
      <div className="flex items-center gap-4">
        <div className="skeleton h-9 w-48" />
        <div className="skeleton h-8 w-16" />
        <div className="skeleton h-8 w-16" />
        <div className="skeleton h-8 w-16" />
      </div>
      <div className="rounded-xl border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
            <div className="skeleton h-2 w-2 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="skeleton h-4 w-48" />
              <div className="skeleton h-3 w-72" />
            </div>
            <div className="skeleton h-5 w-10" />
            <div className="skeleton h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<TasksSkeleton />}>
      <TasksIsland />
    </Suspense>
  );
}
