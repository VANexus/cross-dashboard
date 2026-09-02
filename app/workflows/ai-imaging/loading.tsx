export default function AiImagingLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg skeleton" />
        <div>
          <div className="h-5 w-20 rounded skeleton" />
          <div className="h-3 w-56 rounded skeleton mt-1.5" />
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex gap-3">
          <div className="h-9 flex-1 rounded skeleton" />
          <div className="h-9 flex-1 rounded skeleton" />
          <div className="h-9 w-24 rounded skeleton" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-16 rounded skeleton" />
          ))}
        </div>
        <div className="flex gap-3">
          <div className="h-4 w-16 rounded skeleton" />
          <div className="h-4 w-16 rounded skeleton" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-lg border overflow-hidden">
            <div className="aspect-square skeleton" />
            <div className="p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="h-4 rounded skeleton" />
                <div className="h-4 rounded skeleton" />
              </div>
              <div className="flex justify-between">
                <div className="h-4 w-12 rounded skeleton" />
                <div className="flex gap-1">
                  <div className="h-7 w-7 rounded skeleton" />
                  <div className="h-7 w-7 rounded skeleton" />
                  <div className="h-7 w-7 rounded skeleton" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
