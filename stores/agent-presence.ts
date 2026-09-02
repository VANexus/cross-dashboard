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
  connect: () => () => void;
  setContext: (ctx: Partial<PresenceState['context']>) => void;
  setPageContext: (ctx: PageAgentContext) => void;
  clearPageContext: () => void;
  setDrawerOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  /** 服务端 SSE 之外,本地流(计划执行/问答)写回同一遥测流 */
  pushTelemetry: (agent: string, text: string) => void;
  setLiveState: (state: AgentStateValue, activity: number) => void;
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

  connect: () => {
    const es = new EventSource('/api/agent/stream');
    const apply = (raw: MessageEvent) => {
      let ev: AgentEvent;
      try { ev = JSON.parse(raw.data); } catch { return; }
      if (ev.type === 'state') {
        set({ state: ev.state, activity: ev.activity });
      } else if (ev.type === 'telemetry') {
        set((s) => ({
          telemetry: [{ id: ++seq, agent: ev.agent, text: ev.text }, ...s.telemetry].slice(0, 8),
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
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  pushTelemetry: (agent, text) =>
    set((s) => ({ telemetry: [{ id: ++seq, agent, text }, ...s.telemetry].slice(0, 8) })),
  setLiveState: (state, activity) => set({ state, activity }),
}));
