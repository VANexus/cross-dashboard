// components/agent/agent-dock.tsx
'use client';
// 灵动岛（Agent 的底部 Docker 入口）：替代原 AgentOrb，吸收其职责（SSE 连接 + presence 响应 + 开合抽屉）。
// - busy：头条显示 liveActivity 实时动作（继承球旁实时标签的信息价值）。
// - idle：显示快捷项 = Agent 建议(dockSuggestion) > 焦点联动(关于当前模块) > 预设业务旅程。
// 快捷项统一 {label, prompt} → sendAgentCommand（命令桥会开抽屉+送话，零新增通道）。
import { useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Crosshair, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { usePresence } from '@/stores/agent-presence';
import { sendAgentCommand } from '@/lib/agent/agent-bus';
import { getEnabledJourneys } from '@/lib/journeys/registry';

interface DockItem {
  key: string;
  label: string;
  prompt: string;
  icon?: 'job' | 'focus';
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

export function AgentDock() {
  const reduce = useReducedMotion();
  const connect = usePresence((s) => s.connect);
  const drawerOpen = usePresence((s) => s.drawerOpen);
  const setDrawerOpen = usePresence((s) => s.setDrawerOpen);
  const state = usePresence((s) => s.state);
  const liveActivity = usePresence((s) => s.liveActivity);
  const dockSuggestion = usePresence((s) => s.dockSuggestion);
  const focus = usePresence((s) => s.focus);

  // 建立 SSE 连接（组件常驻，连接随壳层生命周期）
  useEffect(() => connect(), [connect]);

  const busy = liveActivity.kind !== 'idle';
  const accent =
    state === 'consensus'
      ? 'var(--wf-imaging)'
      : state === 'busy'
        ? 'var(--primary)'
        : 'var(--muted-foreground)';

  // 优先级：focus 联动 > Agent 建议 > 预设旅程；最多 3 项，避免拥挤
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
    for (const it of journeyItems()) {
      if (list.length >= 3) break;
      list.push(it);
    }
    return list.slice(0, 3);
  }, [focus, dockSuggestion]);

  if (drawerOpen) return null; // 抽屉展开后灵动岛淡出，避免双入口

  const openDrawer = () => setDrawerOpen(true);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[33] flex justify-center px-4">
      <motion.div
        role="toolbar"
        aria-label="Agent 灵动岛"
        aria-expanded={false}
        initial={false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 26 }}
        className="pointer-events-auto flex max-w-full items-center gap-1 rounded-full border border-border bg-card/90 py-1.5 pl-2 pr-2 shadow-card backdrop-blur-xl"
      >
        {/* 岛头：状态圆点 + 标题（点击开抽屉） */}
        <button
          type="button"
          onClick={openDrawer}
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
        <div className="flex items-center gap-1 overflow-hidden">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => sendAgentCommand(it.prompt)}
              className="flex max-w-44 items-center gap-1.5 rounded-full px-2.5 py-1 text-caption text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {it.icon === 'focus' ? (
                <Crosshair className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : it.icon === 'job' ? (
                <Wand2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{it.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={openDrawer}
          aria-label="展开面板"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </motion.div>
    </div>
  );
}