export default function Loading() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 沉浸式对话画布：居中骨架 */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
        <div className="h-12 w-12 skeleton rounded-2xl" />
        <div className="h-4 w-40 skeleton rounded" />
        <div className="h-3 w-64 skeleton rounded" />
        <div className="mt-4 h-12 w-full max-w-xl skeleton rounded-2xl" />
      </div>
    </div>
  );
}
