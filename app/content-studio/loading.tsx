export default function ContentStudioLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg bg-muted" />
        <div>
          <div className="h-5 w-24 rounded bg-muted" />
          <div className="h-3 w-64 rounded bg-muted mt-1.5" />
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 w-20 rounded-full bg-muted" />)}
        </div>
        <div className="h-10 rounded bg-muted" />
        <div className="h-8 w-24 rounded bg-muted" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4 space-y-2">
          <div className="h-4 w-20 rounded bg-muted" />
          {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded bg-muted" />)}
        </div>
        <div className="rounded-lg border p-4 space-y-2">
          <div className="h-4 w-20 rounded bg-muted" />
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-6 rounded bg-muted" />)}
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="h-6 w-2/3 rounded bg-muted" />
        <div className="h-24 rounded bg-muted" />
      </div>
    </div>
  );
}
