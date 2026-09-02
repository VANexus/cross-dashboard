export default function VideoLocalizationLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg skeleton" />
        <div>
          <div className="h-5 w-24 rounded skeleton" />
          <div className="h-3 w-60 rounded skeleton mt-1.5" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="h-4 w-24 rounded skeleton" />
            <div className="h-24 rounded skeleton" />
            <div className="flex gap-2">
              <div className="h-8 w-28 rounded skeleton" />
              <div className="h-8 w-28 rounded skeleton" />
            </div>
          </div>
          <div className="rounded-lg border">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b">
                {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                  <div key={j} className="h-3 flex-1 rounded skeleton" />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-2">
            <div className="h-4 w-20 rounded skeleton" />
            <div className="h-3 w-32 rounded skeleton" />
          </div>
          <div className="rounded-lg border p-4 space-y-2">
            <div className="h-4 w-24 rounded skeleton" />
            <div className="h-3 w-40 rounded skeleton" />
          </div>
        </div>
      </div>
    </div>
  );
}