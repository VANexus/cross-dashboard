export default function ContentStudioLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg skeleton" />
        <div>
          <div className="h-5 w-24 rounded skeleton" />
          <div className="h-3 w-64 rounded skeleton mt-1.5" />
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 w-20 rounded-full skeleton" />)}
        </div>
        <div className="h-10 rounded skeleton" />
        <div className="h-8 w-24 rounded skeleton" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4 space-y-2">
          <div className="h-4 w-20 rounded skeleton" />
          {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded skeleton" />)}
        </div>
        <div className="rounded-lg border p-4 space-y-2">
          <div className="h-4 w-20 rounded skeleton" />
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-6 rounded skeleton" />)}
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="h-4 w-20 rounded skeleton" />
        <div className="h-6 w-2/3 rounded skeleton" />
        <div className="h-24 rounded skeleton" />
      </div>
    </div>
  );
}
