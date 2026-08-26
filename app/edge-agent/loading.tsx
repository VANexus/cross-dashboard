/**
 * FlowMind — Edge Agent 骨架屏
 *
 * Suspense 加载状态。
 */
export default function EdgeAgentLoading() {
  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col gap-4 p-4 md:p-6">
      <div className="glass-panel flex-1 animate-pulse rounded-2xl p-4">
        <div className="flex h-full flex-col">
          {/* 头部骨架 */}
          <div className="flex items-center gap-3 border-b border-border/50 pb-3">
            <div className="h-9 w-9 rounded-xl bg-muted" />
            <div className="space-y-1">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-2 w-32 rounded bg-muted" />
            </div>
          </div>

          {/* 消息骨架 */}
          <div className="flex flex-1 flex-col justify-center gap-4 p-8">
            <div className="mx-auto h-8 w-8 rounded-full bg-muted" />
            <div className="mx-auto h-3 w-24 rounded bg-muted" />
            <div className="mx-auto h-2 w-48 rounded bg-muted" />
          </div>

          {/* 输入骨架 */}
          <div className="border-t border-border/50 pt-3">
            <div className="h-10 w-full rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
