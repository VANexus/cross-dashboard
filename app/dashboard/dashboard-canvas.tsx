"use client";

/**
 * 仪表盘 Agent 动态画布（主区）。
 *
 * 画布内容由 Agent 经 panel.pin（ui-actions）固定、长期保留（localStorage 写穿），
 * 用户可点 X 移除。渲染复用 component-kit 白名单注册表（componentDefs）：
 * 查表 → propsSchema 防御性校验 → 渲染；未知/失效组件渲染降级块，不崩整屏。
 * 布局：窄组件（stat-card/metric-grid/compare）半宽，图表/表格/时间线整行。
 */
import { useEffect, useMemo } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CANVAS_STORAGE_KEY, usePresence, type CanvasItem } from "@/stores/agent-presence";
import { componentDefs } from "@/components/agent/generated";

/** 窄组件（默认半宽）；其余（图表/表格/时间线等）整行。 */
const NARROW_COMPONENTS = new Set(["stat-card", "metric-grid", "compare"]);

function CanvasTile({ item }: { item: CanvasItem }) {
  const unpin = usePresence((s) => s.unpinCanvasItem);
  const def = componentDefs.find((d) => d.id === item.component);

  let body: React.ReactNode;
  if (!def) {
    body = (
      <div className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        未知白名单组件：{item.component}
      </div>
    );
  } else {
    const parsed = def.propsSchema.safeParse(item.props ?? {});
    if (!parsed.success) {
      body = (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          组件 {item.component} 的 props 校验失败：{parsed.error.issues[0]?.message ?? "未知错误"}
        </div>
      );
    } else {
      body = <>{def.render(parsed.data as Record<string, unknown>)}</>;
    }
  }

  return (
    <div className={cn("relative", !NARROW_COMPONENTS.has(item.component) && "md:col-span-2")}>
      <div className="group relative">
        {item.title && (
          <div className="mb-1.5 flex items-center justify-between px-0.5">
            <span className="text-caption font-semibold text-foreground">{item.title}</span>
          </div>
        )}
        <button
          type="button"
          aria-label={`移除 ${item.title ?? item.component}`}
          title="从画布移除"
          onClick={() => unpin(item.id)}
          className={cn(
            "absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-destructive",
            "group-hover:opacity-100",
          )}
        >
          <X className="h-3 w-3" />
        </button>
        {body}
      </div>
    </div>
  );
}

export function DashboardCanvas() {
  const canvas = usePresence((s) => s.canvas);
  const setCanvas = usePresence((s) => s.setCanvas);
  const setDrawerOpen = usePresence((s) => s.setDrawerOpen);

  // 挂载时从 localStorage 恢复一次（store 服务端求值碰不到 localStorage，故在此恢复）
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CANVAS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CanvasItem[];
      if (Array.isArray(parsed)) setCanvas(parsed.filter((c) => c && typeof c.id === "string"));
    } catch {
      /* 存储损坏则忽略，保持空画布 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(() => canvas, [canvas]);

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-4 max-w-md text-sm text-foreground">
            画布为空。让 Agent 生成图表、表格或指标后，组件会自动固定到这里。
          </p>
          <p className="mt-1.5 max-w-md text-caption text-muted-foreground">
            示例：「分析今日工作流，把趋势图放到仪表盘」
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-5 gap-1.5"
            data-agent-action="orchestrate"
            onClick={() => setDrawerOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            打开助手
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((item) => (
            <CanvasTile key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 画布骨架（配合 loading.tsx / Suspense） */
export function CanvasSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass space-y-3 rounded-xl p-4">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-24 w-full" />
        </div>
      ))}
    </div>
  );
}
