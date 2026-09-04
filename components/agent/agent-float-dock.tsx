// components/agent/agent-float-dock.tsx
'use client';
// 追焦船台：紧贴当前被聚焦的模块锚定，提供「纳入对话上下文」动作。
// 数据来自 presence.focus（use-focus-tracking 侦测）；抽屉展开时隐藏（内容列被挤压会移位）。
// 纯浮层、不抢焦点：不用 focus trap，装饰无需 aria，核心按钮可被键盘触发。
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Crosshair, X } from 'lucide-react';
import { usePresence } from '@/stores/agent-presence';
import { sendAgentCommand } from '@/lib/agent/agent-bus';
import { Button } from '@/components/ui/button';

export function AgentFloatDock() {
  const reduce = useReducedMotion();
  const focus = usePresence((s) => s.focus);
  const drawerOpen = usePresence((s) => s.drawerOpen);
  const clearFocus = usePresence((s) => s.clearFocus);
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!ref.current) return;
    setSize({ w: ref.current.offsetWidth, h: ref.current.offsetHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.module]);

  if (!focus || !focus.rect || drawerOpen) return null;

  const r = focus.rect;
  let left = r.x + r.w + 8;
  let top = r.y - size.h - 8;
  left = Math.max(8, Math.min(left, window.innerWidth - size.w - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - size.h - 8));

  const bringIntoContext = () =>
    sendAgentCommand(`将页面当前聚焦的模块「${focus.label}」纳入对话上下文，围绕它给我分析和可操作建议。`);

  return (
    <motion.div
      ref={ref}
      initial={false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
      className="fixed z-[30] flex items-center gap-1.5 rounded-lg border border-primary/25 bg-card/95 px-1.5 py-1 shadow-card backdrop-blur-md"
      style={{ left, top }}
    >
      <div className="flex items-center gap-1.5 pl-1.5 pr-1 text-caption">
        <Crosshair className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="max-w-40 truncate text-muted-foreground">聚焦：{focus.label}</span>
      </div>
      <Button
        size="sm"
        className="h-6 gap-1 rounded-md px-2 text-caption"
        onClick={bringIntoContext}
      >
        纳入对话
      </Button>
      <button
        type="button"
        aria-label="关闭追焦提示"
        onClick={clearFocus}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted/60"
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
}