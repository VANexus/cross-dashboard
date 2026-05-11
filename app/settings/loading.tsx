export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-4xl animate-pulse">
      <div>
        <div className="h-7 w-32 rounded bg-muted" />
        <div className="h-4 w-48 rounded bg-muted mt-2" />
      </div>

      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-lg border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
          </div>
          <div className="h-3 w-40 rounded bg-muted" />
          <div className="space-y-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center justify-between">
                <div className="h-3 w-48 rounded bg-muted" />
                <div className="h-5 w-10 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end gap-3">
        <div className="h-9 w-16 rounded bg-muted" />
        <div className="h-9 w-20 rounded bg-muted" />
      </div>
    </div>
  );
}
