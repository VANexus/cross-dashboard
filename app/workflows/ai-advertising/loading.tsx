export default function AiAdvertisingLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg bg-muted" />
        <div>
          <div className="h-5 w-28 rounded bg-muted" />
          <div className="h-3 w-60 rounded bg-muted mt-1.5" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-4">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-8 w-full rounded bg-muted" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 w-32 rounded bg-muted" />
              ))}
            </div>
            <div className="rounded border p-3 space-y-2">
              <div className="h-3 w-16 rounded bg-muted" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-3 w-full rounded bg-muted" />
              ))}
            </div>
            <div className="h-9 w-full rounded bg-muted" />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="h-4 w-12 rounded bg-muted" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-16 rounded bg-muted" />
                <div className="h-3 w-20 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border">
            <div className="p-3 border-b">
              <div className="h-4 w-32 rounded bg-muted" />
            </div>
            <div className="p-0">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b">
                  <div className="h-3 flex-1 rounded bg-muted" />
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                    <div key={j} className="h-3 w-12 rounded bg-muted" />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <div className="h-4 w-16 rounded bg-muted" />
                <div className="h-3 w-8 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
