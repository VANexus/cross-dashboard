"use client";

/**
 * 仪表盘 Agent 动态画布（组件包渲染区）。
 *
 * 画布内容由 Agent 经 panel.pin（ui-actions）固定、长期保留（localStorage 写穿），
 * 用户可点 X 移除。渲染复用 component-kit 白名单注册表（componentDefs）：
 * 查表 → propsSchema 防御性校验 → 渲染；未知/失效组件渲染降级块，不崩整屏。
 *
 * 两种形态：
 * - variant="stage"：Agent 舞台（三面一体 stage 面）左栏内嵌本画布——
 *   布局 grid：窄组件（stat-card/metric-grid/compare）半宽，图表/表格/时间线整行。
 * - variant="bar"：仪表盘页「第二状态栏」（实时 pin 状态栏）——
 *   横向紧凑条：pin 组件横排卡片、横向滚动，对话流中 Agent 生成并 pin 的组件实时上墙。
 */
import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CANVAS_STORAGE_KEY, usePresence, type CanvasItem } from "@/stores/agent-presence";
import { componentDefs } from "@/components/agent/generated";

/** 窄组件（stage 网格中默认半宽）；其余（图表/表格/时间线等）整行。 */
const NARROW_COMPONENTS = new Set(["stat-card", "metric-grid", "compare"]);

function CanvasTile({ item }: { item: CanvasItem }) {
  const unpin = usePresence((s) => s.unpinCanvasItem);
  const ref = useRef<HTMLDivElement>(null);
  const def = componentDefs.find((d) => d.id === item.component);

  // 新上墙的组件 GSAP 入场（按 id 挂载一次；既有组件刷新/恢复不重复动画）
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { y: 18, opacity: 0, scale: 0.985 },
      { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: "expo.out" },
    );
    return () => {
      gsap.killTweensOf(el);
    };
  }, []);

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
    <div
      ref={ref}
      className={cn(
        "relative",
        // 窄组件半宽、其余整行
        !NARROW_COMPONENTS.has(item.component) && "md:col-span-2",
      )}
    >
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

  // ── 舞台左栏网格画布（三面一体 stage 面左栏；dashboard 本身用 sticky 图钉）──
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
          <Plus className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-4 max-w-md text-sm text-foreground">
          舞台画布为空。在右侧对话里让 Agent 生成图表、表格或指标，说「放到仪表盘」即可上墙。
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((item) => (
        <CanvasTile key={item.id} item={item} />
      ))}
    </div>
  );
}
