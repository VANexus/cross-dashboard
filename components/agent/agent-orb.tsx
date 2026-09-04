// components/agent/agent-orb.tsx
'use client';
// 智体球 = Agent 的悬浮入口：简洁圆形按钮，状态即颜色。
// 抽屉打开时缩小淡出，关闭时 spring 回到右下角。
// 配色：idle=muted-foreground / busy=primary / consensus=wf-imaging。
// busy 时球旁浮现「实时动作」标签（liveActivity，抽屉推导写回）——关着抽屉也能知道 Agent 在干嘛。
import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { usePresence } from '@/stores/agent-presence';

const ORB = 48;

export function AgentOrb() {
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const state = usePresence((s) => s.state);
  const drawerOpen = usePresence((s) => s.drawerOpen);
  const setDrawerOpen = usePresence((s) => s.setDrawerOpen);
  const connect = usePresence((s) => s.connect);
  const liveActivity = usePresence((s) => s.liveActivity);

  // 建立 SSE 连接（组件常驻，连接随壳层生命周期）
  useEffect(() => connect(), [connect]);

  // 状态 → 强调色
  const accentColor =
    state === 'consensus' ? 'var(--wf-imaging)'
    : state === 'busy' ? 'var(--primary)'
    : 'var(--muted-foreground)';

  // 呼吸节奏：busy/consensus 时脉冲光环，idle 静止
  const breathDuration = state === 'consensus' ? 1.6 : state === 'busy' ? 2.2 : 0;

  const showLive = !drawerOpen && liveActivity && liveActivity.kind !== 'idle';

  return (
    <>
      {/* 实时动作标签：工作中时浮在球左侧（点击同球，打开抽屉） */}
      {showLive && (
        <motion.button
          type="button"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-[26px] right-[74px] z-[33] flex max-w-64 items-center gap-1.5 rounded-lg border border-primary/30 bg-card/90 px-2.5 py-1.5 text-caption text-foreground shadow-card backdrop-blur"
          title="Agent 正在工作，点击查看详情"
        >
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
          <span className="truncate">{liveActivity.text}</span>
        </motion.button>
      )}

      <motion.button
        ref={ref}
        aria-label="Agent 助手 · 开合右侧抽屉"
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(!drawerOpen)}
        initial={false}
        animate={
          reduce
            ? { scale: drawerOpen ? 0 : 1, opacity: drawerOpen ? 0 : 1 }
            : { scale: drawerOpen ? 0.5 : 1, opacity: drawerOpen ? 0 : 1 }
        }
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 28 }}
        whileHover={reduce ? undefined : { scale: drawerOpen ? 0.5 : 1.06 }}
        whileTap={reduce ? undefined : { scale: drawerOpen ? 0.5 : 0.94 }}
        className="fixed bottom-6 right-6 z-[33] flex items-center justify-center rounded-full border bg-card shadow-card transition-colors duration-fast hover:border-primary hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ width: ORB, height: ORB }}
        title={liveActivity && liveActivity.kind !== 'idle' ? liveActivity.text : undefined}
      >
        {/* 状态光环：busy/consensus 时同色脉冲，抽屉打开时隐藏 */}
        {state !== 'idle' && !drawerOpen && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ border: `2px solid ${accentColor}` }}
            animate={reduce ? undefined : { scale: [1, 1.18, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: breathDuration, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* 中心图标 */}
        <Sparkles
          className="relative z-10 h-5 w-5 transition-colors duration-fast"
          style={{ color: accentColor }}
        />
      </motion.button>
    </>
  );
}
