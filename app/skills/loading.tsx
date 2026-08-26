export default function SkillsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="skeleton h-8 w-40 rounded-lg" />
      <div className="skeleton h-4 w-72 max-w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
