export default function ProductResearchLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg skeleton" />
        <div>
          <div className="h-5 w-28 rounded skeleton" />
          <div className="h-3 w-64 rounded skeleton mt-1.5" />
        </div>
      </div>

      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 w-24 rounded-lg skeleton" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20 rounded skeleton" />
                  <div className="h-5 w-12 rounded skeleton" />
                </div>
                <div className="h-1.5 w-full rounded skeleton" />
                <div className="flex justify-between">
                  <div className="h-3 w-16 rounded skeleton" />
                  <div className="h-3 w-8 rounded skeleton" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <div className="h-9 w-24 rounded skeleton" />
            <div className="h-9 w-24 rounded skeleton" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="h-4 w-20 rounded skeleton" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-24 rounded skeleton" />
                <div className="h-3 w-12 rounded skeleton" />
              </div>
            ))}
            <div className="h-2 w-full rounded skeleton" />
          </div>
          <div className="rounded-lg border p-4 space-y-3">
            <div className="h-4 w-24 rounded skeleton mx-auto" />
            <div className="h-8 w-16 rounded skeleton mx-auto" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-3 w-14 rounded skeleton" />
                <div className="h-1.5 flex-1 rounded skeleton" />
                <div className="h-3 w-8 rounded skeleton" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
