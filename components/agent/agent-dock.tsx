// components/agent/agent-dock.tsx
'use client';
// 灵动岛（三面一体的 dock 面）：
// - dock 面（侧栏收起）：底部岛 = 实时状态 + 快捷项（焦点联动 > Agent 建议 > 仪表盘入口 > 预设旅程），
//   点击岛头先记录自身矩形 → setSurface('sidebar')，抽屉的 FLIP 幽灵从岛位生长——岛即面板的种子。
// - sidebar 面（侧栏展开）：岛化为「聚焦气泡」追踪页面当前聚焦模块（GSAP quickTo 平滑跟随），
//   气泡给出 Agent 动态提示推荐，点击即把指令送进侧栏对话（吸收原 agent-float-dock 职责）。
// - stage 面（舞台近全宽）：隐藏，让位全宽画布。
// 快捷项统一 {label, prompt} → sendAgentCommand（命令桥会开抽屉+送话，零新增通道）。
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { gsap } from 'gsap';
import { ChevronRight, Crosshair, LayoutDashboard, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { usePresence } from '@/stores/agent-presence';
import { sendAgentCommand } from '@/lib/agent/agent-bus';
import { rememberDockRect } from '@/lib/agent/surface-morph';
import { getEnabledJourneys } from '@/lib/journeys/registry';
import { useSidebar } from '@/hooks/use-sidebar';
import { cn } from '@/lib/utils';

interface DockItem {
  key: string;
  label: string;
  prompt: string;
  icon?: 'job' | 'focus' | 'canvas';
}

function journeyItems(): DockItem[] {
  return getEnabledJourneys()
    .filter((j) => j.enabled)
    .slice(0, 3)
    .map((j) => ({
      key: `journey-${j.id}`,
      label: j.label,
      prompt: `请帮我执行业务旅程「${j.label}」。`,
      icon: 'job' as const,
    }));
}

/** 聚焦气泡（sidebar 面）：追踪 focus.rect 的提示推荐气泡。 */
function FocusBubble({ reduce }: { reduce: boolean }) {
  const focus = usePresence((s) => s.focus);
  const dockSuggestion = usePresence((s) => s.dockSuggestion);
  const liveActivity = usePresence((s) => s.liveActivity);
  const drawerWidth = usePresence((s) => s.drawerWidth);
  const ref = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const moversRef = useRef<{ x?: (v: number) => void; y?: (v: number) => void }>({});

  const busy = liveActivity.kind !== 'idle';
  /** 气泡文案：Agent 建议 > 忙碌实时动作 > 聚焦模块的默认推荐。 */
  const tip = busy
    ? liveActivity.text
    : dockSuggestion?.label ?? `让 Agent 分析「${focus?.label ?? '当前模块'}」`;
  const prompt = dockSuggestion?.prompt ??
    `围绕用户当前聚焦的模块「${focus?.label ?? ''}」帮我分析并给出可操作建议，必要时执行相关页面动作。`;

  // 平滑跟随时器：quickTo 让气泡游向新锚点而非瞬移
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    moversRef.current.x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    moversRef.current.y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    return () => {
      gsap.killTweensOf(el);
    };
  }, []);

  const place = (immediate: boolean) => {
    const el = ref.current;
    if (!el) return;
    const { w, h } = sizeRef.current;
    let x: number;
    let y: number;
    if (focus?.rect) {
      // 追踪聚焦模块：贴其右上角
      x = focus.rect.x + focus.rect.w + 10;
      y = focus.rect.y - h - 8;
    } else {
      // 无焦点：贴侧栏左缘下侧待命
      x = window.innerWidth - drawerWidth - w - 16;
      y = window.innerHeight - 120;
    }
    const maxX = window.innerWidth - drawerWidth - w - 12;
    x = Math.max(12, Math.min(x, maxX));
    y = Math.max(12, Math.min(y, window.innerHeight - h - 12));
    if (immediate || reduce) {
      gsap.set(el, { x, y });
    } else {
      moversRef.current.x?.(x);
      moversRef.current.y?.(y);
    }
  };

  // 尺寸变化（文案/聚焦切换）→ 重测 → 立即落位，不闪跳
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    sizeRef.current = { w: el.offsetWidth, h: el.offsetHeight };
    place(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.module, focus?.label, dockSuggestion?.label, busy]);

  // 焦点矩形 / 侧栏宽度变化 → 平滑游过去
  useEffect(() => {
    place(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, drawerWidth]);

  // 入场：从聚焦点方向轻弹出现
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    gsap.fromTo(
      el,
      { scale: 0.85, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.6)' },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 既无聚焦也无建议时保持安静（侧栏本体已承载对话）
  if (!focus && !dockSuggestion) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[26]">
      <div
        ref={ref}
        role="status"
        className={cn(
          'agent-focus-bubble pointer-events-auto absolute left-0 top-0 flex max-w-[260px] items-center gap-2 rounded-full border border-primary/30 bg-card/95 py-1.5 pl-2.5 pr-3 shadow-card backdrop-blur-md',
          'cursor-pointer select-none transition-colors hover:border-primary/60',
        )}
        onClick={() => sendAgentCommand(prompt)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            sendAgentCommand(prompt);
          }
        }}
        tabIndex={0}
      >
        <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <Crosshair className="h-3.5 w-3.5 text-primary" />
          )}
        </span>
        <span className="min-w-0 truncate text-caption text-foreground">
          {focus && <span className="font-medium text-primary">聚焦 · {focus.label}</span>}
          {!focus && <span className="font-medium text-primary">Agent 建议</span>}
          <span className="mx-1.5 text-muted-foreground/50">|</span>
          <span className="text-muted-foreground">{tip}</span>
        </span>
      </div>
    </div>
  );
}

/** 灵动岛本体（dock 面）：底部居中，状态 + 快捷项。 */
export function AgentDock() {
  const reduce = useReducedMotion();
  const connect = usePresence((s) => s.connect);
  const drawerOpen = usePresence((s) => s.drawerOpen);
  const stageOpen = usePresence((s) => s.stageOpen);

  // 建立 SSE 连接（组件常驻，连接随壳层生命周期）
  useEffect(() => connect(), [connect]);

  if (stageOpen) return null; // 舞台态让位全宽画布

  if (drawerOpen) {
    return <FocusBubble reduce={!!reduce} />;
  }

  return <Island reduce={!!reduce} />;
}

function Island({ reduce }: { reduce: boolean }) {
  const setSurface = usePresence((s) => s.setSurface);
  const state = usePresence((s) => s.state);
  const liveActivity = usePresence((s) => s.liveActivity);
  const dockSuggestion = usePresence((s) => s.dockSuggestion);
  const focus = usePresence((s) => s.focus);
  const canvasCount = usePresence((s) => s.canvas.length);
  const pathname = usePathname();
  const collapsed = useSidebar((s) => s.collapsed);
  /** dashboard 沉浸式：岛点击聚焦中心对话（不打开抽屉/舞台）。 */
  const immersive = pathname === '/dashboard';

  const islandRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  const busy = liveActivity.kind !== 'idle';
  const accent =
    state === 'consensus'
      ? 'var(--wf-imaging)'
      : state === 'busy'
        ? 'var(--primary)'
        : 'var(--muted-foreground)';

  // 优先级：focus 联动 > Agent 建议 > 仪表盘入口 > 预设旅程；最多 3 项，避免拥挤
  const items = useMemo<DockItem[]>(() => {
    const list: DockItem[] = [];
    if (focus) {
      list.push({
        key: `focus-${focus.module}`,
        label: `关于「${focus.label}」`,
        prompt: `围绕用户当前聚焦的模块「${focus.label}」帮我分析并给出可操作建议，必要时执行相关页面动作。`,
        icon: 'focus',
      });
    }
    if (dockSuggestion) {
      list.push({
        key: `suggest-${dockSuggestion.source}`,
        label: dockSuggestion.label,
        prompt: dockSuggestion.prompt,
      });
    }
    // 非沉浸式页才展示「仪表盘 · N 组件」舞台入口（dashboard 本身即画布，入口无意义）
    if (!immersive && canvasCount > 0) {
      list.push({
        key: 'canvas-open',
        label: `仪表盘 · ${canvasCount} 组件`,
        prompt: '',
        icon: 'canvas',
      });
    }
    for (const it of journeyItems()) {
      if (list.length >= 3) break;
      list.push(it);
    }
    return list.slice(0, 3);
  }, [focus, dockSuggestion, canvasCount, immersive]);

  // 入场：岛弹出 + 快捷项错峰浮现（灵动感的来源）
  useEffect(() => {
    const el = islandRef.current;
    if (!el) return;
    if (reduce) {
      gsap.set(el, { opacity: 1, y: 0, scale: 1 });
    } else {
      gsap.fromTo(
        el,
        { y: 28, scale: 0.9, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.5)' },
      );
      const chips = chipsRef.current?.children;
      if (chips && chips.length > 0) {
        gsap.fromTo(
          chips,
          { y: 8, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out', stagger: 0.05, delay: 0.12 },
        );
      }
    }
    return () => {
      gsap.killTweensOf(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 开侧栏：先记岛矩形（FLIP 幽灵的原点），再换面。沉浸式页改为聚焦中心对话。 */
  const openSidebar = () => {
    if (immersive) {
      focusDashboardChat();
      return;
    }
    rememberDockRect(islandRef.current);
    setSurface('sidebar');
  };
  /** 直接上舞台（仪表盘有货时）：同样从岛位生长。 */
  const openStage = () => {
    rememberDockRect(islandRef.current);
    setSurface('stage');
  };
  /** dashboard 沉浸式：聚焦中心对话输入框（入口仅 dock，无抽屉）。 */
  const focusDashboardChat = () => {
    const input = document.querySelector<HTMLInputElement>('input[aria-label="与 Agent 对话"]');
    if (input) {
      input.focus();
      input.scrollIntoView({ block: 'center' });
    }
  };

  return (
    <div
      className={cn(
        'pointer-events-none fixed z-[33] flex justify-center px-4',
        // dashboard 沉浸式：岛在 header 下方最顶（配合底部固定输入框）；其他页在底部
        immersive ? 'top-[60px] bottom-auto' : 'inset-x-0 bottom-5 top-auto',
      )}
      // dashboard 上按内容区（侧栏右侧）居中，与底部输入框水平对齐
      style={immersive ? { left: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)', right: 0 } : undefined}
    >
      <div
        ref={islandRef}
        role="toolbar"
        aria-label="Agent 灵动岛"
        className={cn(
          'glass-liquid pointer-events-auto flex max-w-full items-center gap-1 overflow-hidden rounded-full py-1.5 pl-2 pr-2',
          busy && 'agent-island-breathe',
        )}
      >
        {/* 岛头：状态圆点 + 标题（点击开侧栏） */}
        <button
          type="button"
          onClick={openSidebar}
          className="flex items-center gap-2 rounded-full px-2.5 py-1 text-caption text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="relative flex h-5 w-5 items-center justify-center">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: accent }} />
            ) : (
              <Sparkles className="h-4 w-4" style={{ color: accent }} />
            )}
          </span>
          <span className="max-w-44 truncate font-medium">
            {busy ? liveActivity.text : 'Agent 助手'}
          </span>
        </button>

        <span aria-hidden className="h-4 w-px bg-border" />

        {/* 快捷项 */}
        <div ref={chipsRef} className="flex items-center gap-1 overflow-hidden">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => {
                if (it.icon === 'canvas') openStage();
                else sendAgentCommand(it.prompt);
              }}
              className="flex max-w-44 items-center gap-1.5 rounded-full px-2.5 py-1 text-caption text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {it.icon === 'focus' ? (
                <Crosshair className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : it.icon === 'job' ? (
                <Wand2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : it.icon === 'canvas' ? (
                <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-wf-imaging" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{it.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={openSidebar}
          aria-label="展开面板"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
