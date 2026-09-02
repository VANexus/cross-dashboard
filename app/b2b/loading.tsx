export default function B2BLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg skeleton" />
        <div className="space-y-1.5">
          <div className="h-5 w-32 skeleton rounded" />
          <div className="h-3 w-72 skeleton rounded" />
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 w-24 rounded-full skeleton" />)}
        </div>
        <div className="h-9 w-40 rounded skeleton" />
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <div className="h-4 w-28 rounded skeleton" />
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 rounded skeleton" />)}
      </div>
    </div>
  );
}
