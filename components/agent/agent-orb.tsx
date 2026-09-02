// components/agent/agent-orb.tsx
'use client';
// 智体球 = Agent 的身体:framer-motion 呼吸(状态驱动节奏)+ 三停泊位滑行(spring)。
// 停泊位:抽屉关 → 右下角;抽屉开 → 抽屉左上角;页面元素带 data-agent-anchor="true" 时贴到其旁。
// 配色接 FlowMind 设计 token:busy=primary(琥珀),consensus=wf-imaging(紫),idle=muted。
import { useEffect, useMemo, useRef } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { CircleDot } from 'lucide-react';
import { usePresence } from '@/stores/agent-presence';

const ORB = 58;
const DRAWER_W = 368;

export function AgentOrb() {
  const ref = useRef<HTMLButtonElement>(null);
  const ctxTagRef = useRef<HTMLSpanElement>(null);
  const ctxTextRef = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const state = usePresence((s) => s.state);
  const drawerOpen = usePresence((s) => s.drawerOpen);
  const setDrawerOpen = usePresence((s) => s.setDrawerOpen);
  const context = usePresence((s) => s.context);
  const connect = usePresence((s) => s.connect);

  // 建立 SSE 连接(组件常驻,连接随壳层生命周期)
  useEffect(() => connect(), [connect]);

  // 状态 → 强调色(busy=primary / consensus=wf-imaging / idle=muted),渐变层经 --orb-accent 消费
  const accentVar =
    state === 'consensus' ? 'var(--wf-imaging)'
    : state === 'busy' ? 'var(--primary)'
    : 'var(--muted-foreground)';

  // 呼吸节奏:空闲慢速,busy/consensus 升速(reduce 时完全静止)
  const breath = state === 'consensus' ? 1.2 : state === 'busy' ? 1.8 : 3.4;

  // 停泊位偏移:客户端量取后 memo 化,交给声明式 spring 动画。
  // 基准位 = CSS right/bottom 锚定的右下角;目标位相对基准求偏移:
  //   抽屉开 → 抽屉左上角;抽屉关 → 右下角(或 data-agent-anchor 锚点旁)
  const berth = useMemo(() => {
    const baseX = window.innerWidth - 24 - ORB / 2;
    const baseY = window.innerHeight - 26 - ORB / 2;
    const homeX = drawerOpen ? window.innerWidth - DRAWER_W : baseX;
    const homeY = drawerOpen ? 30 : baseY;
    const anchor = drawerOpen ? null : document.querySelector<HTMLElement>('[data-agent-anchor="true"]');
    let dx = homeX - baseX, dy = homeY - baseY;
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      const visible = r.width > 0 && r.bottom > 60 && r.top < window.innerHeight - 60;
      if (visible) {
        const cy = Math.max(70, Math.min(r.top + r.height / 2, window.innerHeight - ORB - 66));
        const cx = Math.min(r.right + 10 + ORB / 2, window.innerWidth - 12 - ORB / 2);
        dx = Math.round(cx - baseX); dy = Math.round(cy - baseY);
      }
    }
    return { x: dx, y: dy };
  }, [drawerOpen]);

  // 泊位标签:DOM 直写(外部系统),不经 setState
  useEffect(() => {
    const anchor = drawerOpen ? null : document.querySelector<HTMLElement>('[data-agent-anchor="true"]');
    const tag = ctxTagRef.current;
    if (tag) {
      if (ctxTextRef.current) {
        ctxTextRef.current.textContent = anchor
          ? '正在看:' + (context.selection ?? '选中对象')
          : '';
      }
      animate(tag, { opacity: anchor ? 1 : 0 }, { duration: reduce ? 0 : 0.2 });
    }
  }, [drawerOpen, context.selection, reduce, berth]);

  return (
    <motion.button
      ref={ref}
      aria-label="Agent 智体球 · 开合右侧抽屉"
      aria-expanded={drawerOpen}
      onClick={() => setDrawerOpen(!drawerOpen)}
      initial={false}
      animate={reduce ? { x: berth.x, y: berth.y, scale: 1 } : { x: berth.x, y: berth.y }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 26 }}
      whileHover={reduce ? undefined : { scale: 1.06 }}
      whileTap={reduce ? undefined : { scale: 0.94 }}
      className="fixed right-6 bottom-[26px] z-[33] cursor-pointer border-0 bg-none p-0"
      style={{ width: ORB, height: ORB, ['--orb-accent' as string]: accentVar }}
    >
      {/* 光晕(halo) */}
      <motion.span
        aria-hidden
        className="orb-layer -inset-3.5 rounded-full blur-[2px]"
        style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--orb-accent) 32%, transparent), transparent 62%)' }}
        animate={reduce ? undefined : { scale: [1, 1.16, 1], opacity: [0.55, 0.95, 0.55] }}
        transition={{ duration: breath, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* conic 缓旋光环:仅 busy/consensus 可见 */}
      <motion.span
        aria-hidden
        className="orb-ring orb-layer -inset-2 rounded-full"
        style={{ ['--ring-color' as string]: accentVar }}
        initial={{ opacity: 0, rotate: 0 }}
        animate={state === 'idle' || reduce ? { opacity: 0 } : { opacity: 0.85, rotate: 360 }}
        transition={
          state === 'idle' || reduce
            ? { duration: 0.3 }
            : { opacity: { duration: 0.4 }, rotate: { duration: state === 'consensus' ? 3 : 6, repeat: Infinity, ease: 'linear' } }
        }
      />

      {/* 球体核心 */}
      <motion.span
        aria-hidden
        className="orb-layer inset-0 overflow-hidden rounded-full"
        style={{
          background: 'radial-gradient(circle at 32% 26%, color-mix(in oklch, var(--orb-accent) 45%, white 30%), color-mix(in oklch, var(--orb-accent) 72%, black 8%) 45%, color-mix(in oklch, var(--orb-accent) 45%, black 55%) 100%)',
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.55), inset 0 -6px 14px color-mix(in oklch, var(--orb-accent) 30%, transparent), 0 14px 34px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(6px)',
        }}
        animate={reduce ? undefined : { scaleX: [1, 1.045, 1], scaleY: [1, 0.955, 1] }}
        transition={{ duration: breath, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.span
          aria-hidden
          className="orb-layer -inset-[22%] rounded-full blur-[9px]"
          style={{ background: 'radial-gradient(circle at 64% 70%, color-mix(in oklch, var(--orb-accent) 55%, transparent), transparent 56%)' }}
          animate={reduce ? undefined : { x: ["0%", "8%", "0%"], y: ["0%", "9%", "0%"], scale: [1, 1.18, 1] }}
          transition={{ duration: breath * 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          aria-hidden
          className="orb-layer -inset-[22%] rounded-full blur-[9px]"
          style={{ background: 'radial-gradient(circle at 28% 74%, color-mix(in oklch, var(--primary) 25%, transparent), transparent 52%)' }}
          animate={reduce ? undefined : { x: ["0%", "-7%", "0%"], y: ["0%", "6%", "0%"], scale: [1, 1.15, 1] }}
          transition={{ duration: breath * 2.3, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* 高光 */}
        <span
          aria-hidden
          className="orb-layer left-[18%] top-[11%] h-[22%] w-[34%] -rotate-[20deg] rounded-full blur-[1px]"
          style={{ background: 'linear-gradient(rgba(255,255,255,0.9), transparent)' }}
        />
      </motion.span>

      {/* 泊位上下文标签 */}
      <span
        ref={ctxTagRef}
        className="pointer-events-none absolute right-[68px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border bg-popover/90 px-2.5 py-1 font-mono text-caption text-primary opacity-0 shadow-sm"
        data-testid="orb-ctx-tag"
      >
        <CircleDot className="mr-1 inline h-3 w-3 align-[-1px]" />
        <span ref={ctxTextRef} />
      </span>
    </motion.button>
  );
}
