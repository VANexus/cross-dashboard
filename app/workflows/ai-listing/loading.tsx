export default function AiListingLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg bg-muted" />
        <div>
          <div className="h-5 w-16 rounded bg-muted" />
          <div className="h-3 w-52 rounded bg-muted mt-1.5" />
        </div>
      </div>

      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 w-16 rounded-lg bg-muted" />
        ))}
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-9 w-full rounded bg-muted" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-9 w-full rounded bg-muted" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="h-20 w-full rounded bg-muted" />
        </div>
        <div className="rounded-lg border-2 border-dashed p-8">
          <div className="h-8 w-8 rounded bg-muted mx-auto mb-2" />
          <div className="h-3 w-40 rounded bg-muted mx-auto" />
        </div>
        <div className="h-9 w-32 rounded bg-muted" />
      </div>
    </div>
  );
}
