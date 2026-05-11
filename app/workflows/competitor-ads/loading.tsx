export default function CompetitorAdsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg bg-muted" />
        <div>
          <div className="h-5 w-28 rounded bg-muted" />
          <div className="h-3 w-52 rounded bg-muted mt-1.5" />
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex gap-3">
          <div className="h-9 flex-1 rounded bg-muted" />
          <div className="h-9 w-24 rounded bg-muted" />
          <div className="h-4 w-36 rounded bg-muted" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex justify-between">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 w-16 rounded bg-muted" />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-6 w-28 rounded bg-muted" />
            ))}
          </div>
        </div>
        <div className="rounded-lg border p-4 space-y-4">
          <div className="h-4 w-28 rounded bg-muted" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <div className="h-3 w-8 rounded bg-muted" />
                <div className="h-3 w-12 rounded bg-muted" />
              </div>
              <div className="h-2 w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="h-4 w-20 rounded bg-muted" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between">
                <div className="h-3 w-12 rounded bg-muted" />
                <div className="h-3 w-20 rounded bg-muted" />
              </div>
              <div className="h-1.5 w-full rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border p-4">
          <div className="h-4 w-24 rounded bg-muted mb-3" />
          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded border p-3 space-y-2">
                <div className="h-4 w-16 rounded bg-muted" />
                <div className="h-6 w-8 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
