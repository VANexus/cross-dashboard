export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-7 w-32 rounded skeleton" />
        <div className="h-4 w-48 rounded skeleton mt-2" />
      </div>

      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-lg border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded skeleton" />
            <div className="h-4 w-24 rounded skeleton" />
          </div>
          <div className="h-3 w-40 rounded skeleton" />
          <div className="space-y-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center justify-between">
                <div className="h-3 w-48 rounded skeleton" />
                <div className="h-5 w-10 rounded-full skeleton" />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end gap-3">
        <div className="h-9 w-16 rounded skeleton" />
        <div className="h-9 w-20 rounded skeleton" />
      </div>
    </div>
  );
}
