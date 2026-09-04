// stores/agent-presence.ts
// 全局 Agent 在场状态:EventSource 订阅 /api/agent/stream,驱动球、抽屉、遥测。
// 对应 agent-mvp.html 中的 AgentBus;UI 一律订阅本 store,不互相调用。
// 本地流(plan/ask 的 SSE 消费)通过 pushTelemetry / setLiveState 写回同一数据源。
import { create } from 'zustand';
import type { AgentEvent, AgentStateValue } from '@/lib/agent/contracts';
import type { PageAgentContext } from '@/lib/agent/page-context';

export interface TelemetryItem {
  id: number;
  agent: string;
  text: string;
  /** 到达时间（渲染面板时格式化为 HH:mm:ss） */
  ts: number;
}

/** 主 Agent 实时动作（抽屉推导 → 全局展示：topbar / orb / 心跳） */
export type LiveActivityKind = 'idle' | 'thinking' | 'tool' | 'component' | 'action' | 'l2' | 'error' | 'consensus';
export interface LiveActivity {
  kind: LiveActivityKind;
  text: string;
}

/** 追焦船台：当前页面被聚焦的模块/交互把手（IntersectionObserver 可见份额投票得出） */
export interface FocusTarget {
  module: string;
  label: string;
  rect?: { x: number; y: number; w: number; h: number };
  annotatedAction?: string;
}

/** 灵动岛建议项：Agent 主动推荐的一个动作/工作流 */
export interface DockSuggestion {
  label: string;
  prompt: string;
  source: string;
}

interface PresenceState {
  state: AgentStateValue;
  activity: number;            // 0..1 → GSAP timeScale
  telemetry: TelemetryItem[];
  context: { page: string; selection?: string };
  /** 「页面即上下文」：当前页面经 useAgentPage 上报的完整协议（快照/状态函数化，使用时求值） */
  pageContext: PageAgentContext | null;
  drawerOpen: boolean;
  paletteOpen: boolean;
  /** 右侧对话抽屉宽度（单一真源：抽屉本体 + #app-main margin-push 双读此值） */
  drawerWidth: number;
  /**
   * 全画布舞台：对话不再「贴边一条缝」，而是展开到近全宽（左缘留一截页面作幽灵底衬），
   * 生成组件/图表/长编排在此以大画布呈现。非舞台=常规贴边列（观操作/快速问答）。
   * 关闭时无缝回到 drawerWidth 贴边列。
   */
  stageOpen: boolean;
  /** 追焦船台：当前页面被聚焦的模块（use-focus-tracking 写入） */
  focus: FocusTarget | null;
  /** 灵动岛建议项：Agent 主动推荐（dock.suggest 写入） */
  dockSuggestion: DockSuggestion | null;
  /** 主 Agent 当前在干嘛（抽屉实时推导写回；无对话/空闲为 idle） */
  liveActivity: LiveActivity;
  connect: () => () => void;
  setContext: (ctx: Partial<PresenceState['context']>) => void;
  setPageContext: (ctx: PageAgentContext) => void;
  clearPageContext: () => void;
  setDrawerOpen: (open: boolean) => void;
  setDrawerWidth: (w: number) => void;
  setStageOpen: (open: boolean) => void;
  setFocus: (focus: FocusTarget | null) => void;
  clearFocus: () => void;
  setDockSuggestion: (s: DockSuggestion | null) => void;
  setPaletteOpen: (open: boolean) => void;
  /** 服务端 SSE 之外,本地流(计划执行/问答)写回同一遥测流 */
  pushTelemetry: (agent: string, text: string) => void;
  setLiveState: (state: AgentStateValue, activity: number) => void;
  setLiveActivity: (live: LiveActivity) => void;
}

let seq = 0;

export const usePresence = create<PresenceState>((set) => ({
  state: 'idle',
  activity: 0.12,
  telemetry: [],
  context: { page: '运营总览' },
  pageContext: null,
  drawerOpen: false,
  paletteOpen: false,
  drawerWidth: 540,
  stageOpen: false,
  focus: null,
  dockSuggestion: null,
  liveActivity: { kind: 'idle', text: '' },

  connect: () => {
    const es = new EventSource('/api/agent/stream');
    const apply = (raw: MessageEvent) => {
      let ev: AgentEvent;
      try { ev = JSON.parse(raw.data); } catch { return; }
      if (ev.type === 'state') {
        set({ state: ev.state, activity: ev.activity });
      } else if (ev.type === 'telemetry') {
        set((s) => ({
          telemetry: [{ id: ++seq, agent: ev.agent, text: ev.text, ts: Date.now() }, ...s.telemetry].slice(0, 8),
        }));
      }
    };
    es.addEventListener('state', apply as EventListener);
    es.addEventListener('telemetry', apply as EventListener);
    return () => es.close();
  },

  setContext: (ctx) => set((s) => ({ context: { ...s.context, ...ctx } })),
  setPageContext: (ctx) => set({ pageContext: ctx }),
  clearPageContext: () => set({ pageContext: null }),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setDrawerWidth: (w) => set({ drawerWidth: w }),
  setStageOpen: (open) => set({ stageOpen: open }),
  setFocus: (focus) => set({ focus }),
  clearFocus: () => set({ focus: null }),
  setDockSuggestion: (dockSuggestion) => set({ dockSuggestion }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  pushTelemetry: (agent, text) =>
    set((s) => ({ telemetry: [{ id: ++seq, agent, text, ts: Date.now() }, ...s.telemetry].slice(0, 8) })),
  setLiveState: (state, activity) => set({ state, activity }),
  setLiveActivity: (live) => set({ liveActivity: live }),
}));
