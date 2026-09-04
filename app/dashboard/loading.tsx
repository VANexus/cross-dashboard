export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="data-grid grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1 p-4">
            <div className="h-3 w-20 skeleton rounded" />
            <div className="h-7 w-16 skeleton rounded mt-1" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 p-4">
            <div className="h-4 w-28 skeleton rounded" />
            <div className="h-24 w-full skeleton rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
