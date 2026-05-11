export default function InventoryLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg bg-muted" />
        <div>
          <div className="h-5 w-24 rounded bg-muted" />
          <div className="h-3 w-60 rounded bg-muted mt-1.5" />
        </div>
      </div>

      <div className="grid gap-3 grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-lg border p-3 text-center space-y-1">
            <div className="h-4 w-4 rounded bg-muted mx-auto" />
            <div className="h-6 w-8 rounded bg-muted mx-auto" />
            <div className="h-3 w-10 rounded bg-muted mx-auto" />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="h-9 w-48 rounded bg-muted" />
        <div className="h-9 w-24 rounded bg-muted" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((j) => (
                <div key={j} className="h-3 flex-1 rounded bg-muted" />
              ))}
            </div>
          ))}
        </div>

        <div className="rounded-lg border p-8 text-center">
          <div className="h-10 w-10 rounded bg-muted mx-auto mb-3" />
          <div className="h-3 w-28 rounded bg-muted mx-auto" />
        </div>
      </div>
    </div>
  );
}
