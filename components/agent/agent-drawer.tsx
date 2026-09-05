// components/agent/agent-drawer.tsx
'use client';
// 右侧 Agent 抽屉（三面一体的 sidebar / stage 面）：
// ai@7 useChat（transport → /api/agent/chat，请求体带动态 pageContext）：
// token 级流式文本 + ui_action client tool 本地执行（按 id 路由 → zod 校验 → execute → addToolResult 回传统推）。
// 打开时把主内容(#app-main 父列)真实挤压缩排；问答锚定 presence.context；球状态经 setLiveState 联动。
// 三面一体（dock ⇄ sidebar ⇄ stage）状态交换一律 GSAP 优先：
//  - 岛 → 面板：FLIP 幽灵从灵动岛矩形生长成面板（岛即面板种子），面板本体淡入接力；
//  - 面板 → 岛：幽灵收拢回岛锚点，岛随后弹出接力；
//  - sidebar → stage：宽度 expo 补间 + 仪表盘画布分栏从左侧滑入 + 全屏 scrim；
//  - stage = 舞台即 dashboard：左栏 Agent 仪表盘（动态画布）+ 右栏对话，组件经 panel.pin 实时上墙。
// 视觉遵循 FlowMind 设计 token（globals.css），骨架件复用 components/ui。
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { gsap } from 'gsap';
import { Check, ChevronDown, LayoutDashboard, Loader2, Maximize2, MessageSquare, PanelBottom, PanelRight, Plus, Radar, SendHorizontal, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import type { UseChatHelpers } from '@ai-sdk/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { SPEC_DATA_PART_TYPE } from '@json-render/core';
import type { DataPart } from '@json-render/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePresence, type AgentSurface } from '@/stores/agent-presence';
import { getClientKernel, whenKernelReady } from '@/lib/kernel';
import {
  createGlobalActions,
  getActionById,
  getPageActions,
  installAgentTestHook,
  riskLevelOf,
  RISK_META,
  type UIActionDef,
} from '@/lib/agent/ui-actions';
import { serializePageContext } from '@/lib/agent/page-context';
import { subscribeAgentCommand } from '@/lib/agent/agent-bus';
import { islandAnchorRect, morphGhost, takeDockRect, type MorphRect } from '@/lib/agent/surface-morph';
import {
  dbMessageToUI,
  deriveLiveActivity,
  renderComponentInputSchema,
  uiActionInputSchema,
  CONV_STORAGE_KEY,
  type AgentUIMessage,
  type ConversationSummary,
  type PendingL2,
} from '@/lib/agent/chat-contract';
import { componentDefs, GeneratedComponent } from '@/components/agent/generated';
import { JsonRenderMessageView } from '@/components/agent/generated/json-render-view';
import { installGenUIActionRunner } from '@/lib/agent/genui/registry';
import { DashboardCanvas } from '@/app/dashboard/dashboard-canvas';
import { MarkdownMessage } from '@/components/agent/markdown-message';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusDot } from '@/components/ui/status-dot';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// 右侧抽屉可拖宽：主区间档位 SNAP_STEPS，超 MAX 且越过阈值进入「展开」全宽画布；默认 540。
const SNAP_STEPS = [440, 540, 640];
const EXPANDED_W = 748;
const DEFAULT_W = 540;
const MIN_W = 440;
const MAX_W = 640;
const DRAWER_RESIZE_KEY = 'flowmind.drawerWidth';
const EASE = [0.16, 1, 0.3, 1] as const; // 对齐 --ease-out
// 舞台态：对话展开到近全宽（左缘留 STAGE_EDGE 一截页面作幽灵底衬），上限 STAGE_W_MAX。
// 只有切换舞台时才走 GSAP 宽度补间；拖动仍即时（resizing 时关补间）。
const STAGE_EDGE = 96;
const STAGE_W_MAX = 1200;
// 舞台态对话列固定最小框（与旧 flex 布局的 w-[400px] 对齐）。
// 侧栏 ⇄ 舞台的分栏切换由 GSAP 与 aside 宽度同一 timeline 协调（不靠 CSS transition，
// 避免 flex↔fixed 类切换导致的瞬时跳变/溢出错乱）。
const CHAT_W = 400;

/** 三面一体模式切换器条目（dock=灵动岛 / sidebar=侧栏 / stage=舞台·仪表盘）。 */
const SURFACE_MODES = [
  { id: 'dock' as const, icon: PanelBottom, label: '灵动岛' },
  { id: 'sidebar' as const, icon: PanelRight, label: '侧栏' },
  { id: 'stage' as const, icon: LayoutDashboard, label: '舞台 · 仪表盘' },
];

// ── 上下文统计（与 /api/agent/context-stats 响应同构）────────────────
interface ContextBreakdownItem {
  key: string;
  label: string;
  tokens: number;
  pct: number;
}
interface ContextStatsPayload {
  total: number;
  window: number;
  pct: number;
  breakdown: ContextBreakdownItem[];
}

function formatTokens(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

/** 占用率配色：<50 muted / <80 warning / ≥80 danger */
function pctTone(pct: number): string {
  if (pct >= 80) return 'bg-danger/10 text-destructive';
  if (pct >= 50) return 'bg-warning/10 text-warning';
  return 'bg-muted text-muted-foreground';
}

/**
 * 组件流式生成骨架：模型仍在输出 render_component 参数时展示——
 * 标题条 + 内容区的 shimmer 占位，替代原来的小 badge，让「生成组件」有渐进成型的观感。
 */
function ComponentSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-3" aria-busy="true">
      <div className="flex items-center gap-2 text-caption text-muted-foreground">
        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
        <span>正在流式生成组件…</span>
      </div>
      <div className="mt-2.5 space-y-1.5">
        <div className="h-2 w-1/3 animate-pulse rounded-full bg-muted" />
        <div className="h-2 w-2/3 animate-pulse rounded-full bg-muted" />
        <div className="h-20 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

/**
 * 抽屉顶部实时活动横幅（钉住不随对话滚动）：把「Agent 正在干嘛」摆到眼前——
 * 正在思考 / 正在调用工具 X / 正在生成图表 / 正在执行动作 / 等待你确认 / 失败 / 共识投票。
 * idle 时不渲染（避免噪音）；数据来自全局 liveActivity（抽屉推导写回）。
 */
function AgentActivityBanner() {
  const live = usePresence((s) => s.liveActivity);
  if (!live || live.kind === 'idle') return null;

  const META: Record<string, { icon: typeof Loader2; spin: boolean; cls: string }> = {
    thinking: { icon: Loader2, spin: true, cls: 'border-primary/30 bg-primary/8 text-primary' },
    tool: { icon: Loader2, spin: true, cls: 'border-primary/30 bg-primary/8 text-primary' },
    component: { icon: Loader2, spin: true, cls: 'border-primary/30 bg-primary/8 text-primary' },
    action: { icon: Loader2, spin: true, cls: 'border-primary/30 bg-primary/8 text-primary' },
    l2: { icon: ShieldAlert, spin: false, cls: 'border-warning/40 bg-warning/10 text-warning' },
    error: { icon: X, spin: false, cls: 'border-danger/40 bg-danger/10 text-destructive' },
    consensus: { icon: Loader2, spin: true, cls: 'border-wf-imaging/40 bg-wf-imaging/10 text-wf-imaging' },
  };
  const meta = META[live.kind] ?? META.thinking;
  const Icon = meta.icon;
  const working =
    live.kind === 'thinking' || live.kind === 'tool' || live.kind === 'component' ||
    live.kind === 'action' || live.kind === 'consensus';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'relative mx-4 mt-2 flex min-h-8 items-center gap-2 overflow-hidden rounded-lg border px-2.5 py-1.5',
        meta.cls,
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', meta.spin && 'animate-spin')} />
      <span className="truncate text-caption font-medium">{live.text}</span>
      {working && (
        <>
          <span className="ml-auto shrink-0 font-mono text-tiny opacity-60">执行中</span>
          <span className="agent-activity-bar" aria-hidden />
        </>
      )}
      {live.kind === 'l2' && (
        <span className="ml-auto shrink-0 font-mono text-tiny opacity-80">需要你操作</span>
      )}
      <style>{`
        .agent-activity-bar {
          position: absolute; left: 0; bottom: 0; height: 2px; width: 40%; border-radius: 9999px;
          background: currentColor; opacity: .65;
          animation: agentActivitySlide 1.2s ease-in-out infinite;
        }
        @keyframes agentActivitySlide {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(360%); }
        }
      `}</style>
    </div>
  );
}

export function AgentDrawer() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const drawerOpen = usePresence((s) => s.drawerOpen);
  const stageOpen = usePresence((s) => s.stageOpen);
  const setSurface = usePresence((s) => s.setSurface);
  const pathname = usePathname();

  // 全局动作闭包需要感知当前路由（避免把 pathname 加进注册 effect 依赖导致重复注册）
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // dashboard 沉浸式页禁用三面一体面板：main 即沉浸式对话画布，入口仅灵动岛 dock。
  // （渲染提前 return 必须在所有 hooks 之后，这里仅作渲染短路）
  const dashboardImmersive = pathname === '/dashboard';

  // 三面一体与 dashboard 沉浸式边界的同步：
  // - 进入 dashboard（immersive 变 true）：强制回到 dock，清掉侧栏/舞台停留态（margin 挤压、dock 变气泡等），
  //   否则 main body 回不去。
  // - 离开 dashboard（immersive 变 false）：同样重置回 dock，避免上一页残留的侧栏/舞台态
  //   （以及被打断的收拢动画导致的可见抽屉）泄漏到新页面。
  // 该 effect 依赖 dashboardImmersive，双向变化都会触发一次 dock 归一。
  useEffect(() => {
    const s = usePresence.getState();
    if (s.drawerOpen || s.stageOpen) s.setSurface('dock');
  }, [dashboardImmersive]);

  const canvasCount = usePresence((s) => s.canvas.length);
  const drawerWidth = usePresence((s) => s.drawerWidth);
  const setDrawerWidth = usePresence((s) => s.setDrawerWidth);
  const state = usePresence((s) => s.state);
  const telemetry = usePresence((s) => s.telemetry);
  const context = usePresence((s) => s.context);
  const pushTelemetry = usePresence((s) => s.pushTelemetry);
  const setLiveState = usePresence((s) => s.setLiveState);
  const setLiveActivity = usePresence((s) => s.setLiveActivity);
  const liveActivity = usePresence((s) => s.liveActivity);
  const [input, setInput] = useState('');
  // 拖动调节宽度时关掉过渡（拖动要即时跟手，不能有补间拖尾）；
  // 松手/切舞台进入非 resizing 态，宽度变化恢复 GSAP 补间。
  const [resizing, setResizing] = useState(false);
  // dashboard 沉浸式收拢卸载门：路由切到 /dashboard 时先把面板收拢动画（ghost 收拢回岛）播完，
  // 再真正卸载 aside——否则 return null 会直接把面板卸载导致「瞬间消失」。
  const [immersiveExited, setImmersiveExited] = useState(false);
  const stageW = typeof window !== 'undefined' ? Math.max(MIN_W, Math.min(STAGE_W_MAX, window.innerWidth - STAGE_EDGE)) : EXPANDED_W;
  /** 抽屉实际宽度：舞台态走近全宽，常规态走用户拖带记忆的 drawerWidth。 */
  const effectiveWidth = stageOpen ? stageW : drawerWidth;
  /** 三面一体当前形态（唯一口径）。dashboard 沉浸式页强制 dock（面板不参与），
   *  保证从其他页切入时 aside 先走收起动画（ghost 收拢）而非被卸载直接消失。 */
  const surface: AgentSurface = dashboardImmersive ? 'dock' : stageOpen ? 'stage' : drawerOpen ? 'sidebar' : 'dock';

  // ── GSAP 表面交换基建：面板本体 / FLIP 幽灵 / 舞台分栏 / 全屏 scrim ──
  const asideRef = useRef<HTMLElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLButtonElement>(null);
  const stagePaneRef = useRef<HTMLDivElement>(null);
  const chatColRef = useRef<HTMLElement>(null);
  const prevSurfaceRef = useRef<AgentSurface>('dock');

  const helpersRef = useRef<UseChatHelpers<AgentUIMessage> | null>(null);
  const messagesRef = useRef<AgentUIMessage[]>([]);
  // 同步流护栏：chat.status 是 React 状态（异步更新），连点多个按钮时可能仍为 idle；
  // 用 ref 同帧置位，保证同一时刻只有一条 Agent 流在跑，其余命令入队串行补发。
  const streamBusyRef = useRef(false);

  // ── 上下文组成 + 占模型窗口百分比（默认收起，展开后展示）──────────────
  const [ctxStats, setCtxStats] = useState<ContextStatsPayload | null>(null);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxLoaded, setCtxLoaded] = useState(false);

  // L2 人在环中：对外/不可逆动作挂起，等用户在确认卡上当次决策
  const [pendingL2, setPendingL2] = useState<PendingL2[]>([]);
  const pendingL2Ref = useRef<PendingL2[]>([]);
  const l2ApiRef = useRef<{
    enqueue: (actionId: string, params?: Record<string, unknown>) => string | null;
    list: () => PendingL2[];
    resolve: (toolCallId: string, approve: boolean) => void;
  }>(null as unknown as {
    enqueue: (actionId: string, params?: Record<string, unknown>) => string | null;
    list: () => PendingL2[];
    resolve: (toolCallId: string, approve: boolean) => void;
  });

  /** addToolResult 兜底：toolCallId 已不在消息树（测试缝/竞态/已卸载）时不回传，更不能产生 unhandledRejection。 */
  function safeAddToolResult(args: Parameters<NonNullable<UseChatHelpers<AgentUIMessage>['addToolResult']>>[0]) {
    const stillTracked = messagesRef.current.some((m) =>
      m.parts.some(
        (pt) =>
          (pt.type === 'tool-ui_action' || pt.type === 'tool-render_component') &&
          pt.toolCallId === args.toolCallId,
      ),
    );
    if (!stillTracked) {
      // 没有等待回传的 tool part（如 e2e 合成调用或用户已离开），回传只会抛错，直接忽略
      return;
    }
    try {
      const p = helpersRef.current?.addToolResult(args);
      if (p && typeof (p as Promise<unknown>).catch === 'function') {
        (p as Promise<unknown>).catch((err) => {
          console.warn('[agent] addToolResult 未被消息树接收', err);
        });
      }
    } catch (err) {
      console.warn('[agent] addToolResult 调用失败', err);
    }
  }

  /** 真正执行一个已通过校验/授权的动作，并把结果回传模型续推。 */
  function executeActionNow(
    toolCallId: string,
    action: UIActionDef,
    params: Record<string, unknown>,
  ) {
    pushTelemetry('Agent', `执行 UI 动作 · ${action.id}（${RISK_META[riskLevelOf(action)].label}）`);
    Promise.resolve()
      .then(() => action.execute(params))
      .then((summary) => {
        safeAddToolResult({ tool: 'ui_action', toolCallId, output: summary });
        pushTelemetry('Agent', summary.slice(0, 24));
      })
      .catch((err) =>
        safeAddToolResult({
          tool: 'ui_action',
          toolCallId,
          state: 'output-error',
          errorText: `动作 ${action.id} 执行失败：${err instanceof Error ? err.message : String(err)}`,
        }),
      );
  }

  /** L2 挂起：校验参数后生成确认卡，不执行、不回传，流暂停等待用户。 */
  function enqueueL2(action: UIActionDef, toolCallId: string, params: Record<string, unknown>) {
    const explain =
      typeof action.confirmText === 'function'
        ? action.confirmText(params)
        : action.confirmText ??
          `动作「${action.id}」属于对外/不可逆操作（L2），执行后无法自动撤销，请确认是否继续。`;
    setPendingL2((prev) =>
      prev.some((p) => p.toolCallId === toolCallId)
        ? prev
        : [...prev, { toolCallId, actionId: action.id, params, explain }],
    );
  }

  /** 用户决策 L2：批准→执行；取消→以正常结果回传「未执行」，避免模型误判失败而重试。 */
  function resolveL2(toolCallId: string, approve: boolean) {
    const pending = pendingL2Ref.current.find((p) => p.toolCallId === toolCallId);
    setPendingL2((prev) => prev.filter((p) => p.toolCallId !== toolCallId));
    if (!pending) return;
    if (!approve) {
      pushTelemetry('Agent', `已取消 L2 动作 · ${pending.actionId}`);
      safeAddToolResult({
        tool: 'ui_action',
        toolCallId,
        output: `用户已取消动作「${pending.actionId}」，未执行任何变更。请不要重试该动作，改为询问用户下一步意图。`,
      });
      return;
    }
    const action = getActionById(pending.actionId);
    if (!action) {
      safeAddToolResult({
        tool: 'ui_action',
        toolCallId,
        output: `动作「${pending.actionId}」当前已不可用（可能已离开对应页面），未执行。`,
      });
      return;
    }
    executeActionNow(toolCallId, action, pending.params);
  }

  // 每渲染后同步 ref（不在渲染期读写 ref）：保证测试缝与 resolve 取到最新 pendingL2
  useEffect(() => {
    pendingL2Ref.current = pendingL2;
    l2ApiRef.current = {
      list: () => pendingL2Ref.current,
      resolve: resolveL2,
      enqueue: (actionId, params = {}) => {
        const action = getActionById(actionId);
        if (!action || riskLevelOf(action) !== 'L2') return null;
        let p = params;
        if (action.schema) {
          const pr = action.schema.safeParse(params);
          if (!pr.success) return null;
          p = (pr.data ?? {}) as Record<string, unknown>;
        }
        const toolCallId = `test-l2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        enqueueL2(action, toolCallId, p);
        return toolCallId;
      },
    };
  });

  // 注册通用动作（navigate/refresh 需要 router；抽屉是贯穿所有页面的全局客户端挂载点）
  // 内核服务为异步 fiber 挂载：经 whenKernelReady 等就绪后再注册（杜绝竞速 undefined）
  // dashboard 沉浸式页不启用抽屉：内核由 DashboardChat 挂载，此处跳过避免重复。
  useEffect(() => {
    if (dashboardImmersive) return;
    let cancelled = false;
    whenKernelReady()
      .then((kernel) => {
        if (cancelled) return;
        kernel.actions.registerGlobalActions(
          createGlobalActions({
            onNavigate: (route) => {
              // AI 自动跳页时确保对话侧栏保持可见，避免对着话突然没了聊天框：
              // - 常规页：先展开侧栏再跳转（SPA 状态不丢）；
              // - 从 /dashboard 沉浸式页离开：抽屉在沉浸页被强制 dock，待路由生效后再展开，避免在沉浸页上闪出面板。
              const s = usePresence.getState();
              const leavingImmersive = pathnameRef.current === '/dashboard';
              if (leavingImmersive) {
                router.push(route);
                window.setTimeout(() => {
                  const st = usePresence.getState();
                  if (!st.drawerOpen && !st.stageOpen && window.location.pathname !== '/dashboard') st.setSurface('sidebar');
                }, 300);
              } else {
                if (!s.drawerOpen && !s.stageOpen) s.setSurface('sidebar');
                router.push(route);
              }
            },
            onRefresh: () => router.refresh(),
          }),
        );
        // 测试/调试钩子：e2e 可经 window.__agentUI 快速驱动全部动作（生产自动跳过）
        installAgentTestHook();
        // L2 确认门的确定性测试缝（不依赖真实 LLM）：挂起/列举/决策
        if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
          const hook = (window as unknown as { __agentUI?: Record<string, unknown> }).__agentUI ?? {};
          hook.enqueueL2ForTest = (id: string, params?: Record<string, unknown>) =>
            l2ApiRef.current.enqueue(id, params);
          hook.listPendingL2 = () => l2ApiRef.current.list();
          hook.resolveL2ForTest = (callId: string, approve: boolean) =>
            l2ApiRef.current.resolve(callId, approve);
          (window as unknown as { __agentUI: Record<string, unknown> }).__agentUI = hook;
        }
        // 生成式 UI 白名单组件注册（M3 component-kit：注册表归内核所有，同 id 覆盖热更新安全）
        kernel.components.registerAll(componentDefs);
      })
      .catch((err) => {
        if (!cancelled) console.error('[web-kernel] 全局动作/组件注册失败', err);
      });
    return () => {
      cancelled = true;
    };
  }, [router, dashboardImmersive]);

  // transport 指向 /api/agent/chat；body 每次发送时求值：
  // - 从 presence store 取当前页面上下文
  // - 若处于 /agents/[id] 页，自动携带 agentId → 服务端注入该 Agent 人格/目标/语义召回记忆/自进化能力
  const boundAgentId = pathname?.match(/^\/agents\/([^/]+)$/)?.[1];

  // ── AI-Native 对话历史：当前会话 + 会话列表（持久化到 PG，可恢复/切换） ──
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [convTitle, setConvTitle] = useState('新对话');
  const convIdRef = useRef<string | null>(null);
  const convLoadedRef = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AgentUIMessage>({
        api: '/api/agent/chat',
        body: () => {
          const pageContext = serializePageContext();
          const payload: Record<string, unknown> = {};
          if (pageContext) payload.pageContext = pageContext;
          if (boundAgentId) payload.agentId = boundAgentId;
          if (convIdRef.current) payload.conversationId = convIdRef.current;
          return payload;
        },
      }),
    [boundAgentId],
  );

  const chat = useChat<AgentUIMessage>({
    transport,
    // client tool 结果回传后自动续推（官方 client-side tools 模式）
    sendAutomaticallyWhen: ({ messages }) =>
      lastAssistantMessageIsCompleteWithToolCalls({ messages }),
    // ui_action 本地执行：按 id 路由到注册动作 → zod 校验 params → execute → addToolResult
    // render_component 本地执行：白名单查表 → zod 校验 props → 回传「已渲染」，组件随消息流渲染
    onToolCall: ({ toolCall }) => {
      if (toolCall.dynamic) return;
      const failWith =
        (tool: 'ui_action' | 'render_component') =>
        (errorText: string) =>
          safeAddToolResult({
            tool,
            toolCallId: toolCall.toolCallId,
            state: 'output-error',
            errorText,
          });

      if (toolCall.toolName === 'render_component') {
        const fail = failWith('render_component');
        const parsed = renderComponentInputSchema.safeParse(toolCall.input);
        if (!parsed.success) {
          fail(`render_component 输入不合法：${parsed.error.message}`);
          return;
        }
        const components = getClientKernel().components;
        const def = components.getComponent(parsed.data.component);
        if (!def) {
          fail(
            `未注册的白名单组件：${parsed.data.component}（可用：${
              components.listComponents().map((d) => d.id).join(', ') || '无'
            }）`,
          );
          return;
        }
        const pr = def.propsSchema.safeParse(parsed.data.props ?? {});
        if (!pr.success) {
          fail(`组件 ${def.id} props 不合法：${pr.error.message}`);
          return;
        }
        pushTelemetry('Agent', `动态渲染 · ${def.id}`);
        safeAddToolResult({
          tool: 'render_component',
          toolCallId: toolCall.toolCallId,
          output: `已渲染组件 ${def.id}`,
        });
        return;
      }

      if (toolCall.toolName !== 'ui_action') return;
      const fail = failWith('ui_action');
      const parsed = uiActionInputSchema.safeParse(toolCall.input);
      if (!parsed.success) {
        fail(`ui_action 输入不合法：${parsed.error.message}`);
        return;
      }
      const action = getActionById(parsed.data.id);
      if (!action) {
        fail(
          `未注册的 UI 动作：${parsed.data.id}（当前可用：${
            getPageActions().map((a) => a.id).join(', ') || '无'
          }）`,
        );
        return;
      }
      let params: Record<string, unknown> = {};
      if (action.schema) {
        const pr = action.schema.safeParse(parsed.data.params ?? {});
        if (!pr.success) {
          fail(`动作 ${action.id} 参数不合法：${pr.error.message}`);
          return;
        }
        params = (pr.data ?? {}) as Record<string, unknown>;
      }
      // L2 对外/不可逆动作：不自动执行，挂起并弹确认卡，等用户当次批准
      if (riskLevelOf(action) === 'L2') {
        pushTelemetry('Agent', `L2 动作待批准 · ${action.id}`);
        enqueueL2(action, toolCall.toolCallId, params);
        return;
      }
      // L0/L1：直接执行
      executeActionNow(toolCall.toolCallId, action, params);
    },
    onError: () => {
      streamBusyRef.current = false;
      setLiveState('idle', 0.12);
    },
    onFinish: ({ isError }) => {
      streamBusyRef.current = false;
      setLiveState('idle', 0.12);
      pushTelemetry('选品 Agent', isError ? '回答中断' : '就地回答完成 ✓');
    },
  });
  // useChat 官方模式:每次渲染后经 effect 刷新 ref,保证 onToolCall 闭包取到最新 helpers/messages
  useEffect(() => {
    helpersRef.current = chat;
    messagesRef.current = chat.messages;
  });

  // json-render 生成 UI 的按钮动作 → 走与 ui_action 相同的动作路由（含 L2 门）
  useEffect(() => {
    installGenUIActionRunner((id, params) => {
      const action = getActionById(id);
      if (!action) return;
      if (riskLevelOf(action) === 'L2') {
        enqueueL2(action, `genui-${id}-${Date.now()}`, params);
        return;
      }
      executeActionNow(`genui-${id}-${Date.now()}`, action, params);
    });
  }, []);

  const messages = chat.messages;
  const status = chat.status;
  const busy = status === 'streaming' || status === 'submitted';
  // 对话里是否已有「落地/可用的生成组件」→ 桌面态在头部弹「进舞台全宽查看」软建议。
  // 只在非舞台且存在大组件时提示（建议但不由你，永不吓人）。
  const hasComponent = useMemo(
    () =>
      messages.some((m) =>
        m.parts.some(
          (p) =>
            p.type === 'tool-render_component' &&
            (p.state === 'input-available' || p.state === 'output-available'),
        ),
      ),
    [messages],
  );

  // GSAP 灵动动画：新消息/新组件入场（y 上浮 + 淡入）。流式更新不重复动画（按 idx 去重）。
  const messagesListRef = useRef<HTMLDivElement>(null);
  const animatedMsgIdxRef = useRef(-1);
  useEffect(() => {
    const len = messages.length;
    if (len === 0 || len <= animatedMsgIdxRef.current) return;
    const idx = len - 1;
    const el = messagesListRef.current?.querySelector(`[data-msg-idx="${idx}"]`);
    if (el) {
      animatedMsgIdxRef.current = idx;
      gsap.fromTo(el, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' });
    }
  }, [messages.length]);

  // 长会话虚拟滚动：仅当历史消息很多时才启用，避免 DOM 数量拖慢滚轮/渲染。
  // 阈值以下走普通渲染（保 GSAP 入场、流式增量、拖拽动画的原汁原味）；超过阈值才按需渲染视口内消息。
  // scrollElement 指向 Radix ScrollArea 的 viewport（真正的滚动容器）。
  const VIRTUALIZE_THRESHOLD = 24;
  const virtualize = messages.length > VIRTUALIZE_THRESHOLD;
  const virtualScrollRef = useRef<HTMLDivElement>(null);
  const [viewportEl, setViewportEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setViewportEl(messagesListRef.current?.parentElement ?? null);
  }, [virtualize]);
  const rowVirtualizer = useVirtualizer({
    count: virtualize ? messages.length : 0,
    getScrollElement: () => viewportEl,
    estimateSize: () => 120,
    overscan: 6,
    getItemKey: (i) => messages[i]?.id ?? i,
  });

  // 上下文统计：随消息/页面变化防抖拉取（口径与 /api/agent/chat 同源），过期响应丢弃
  const ctxFetchId = useRef(0);
  useEffect(() => {
    const id = ++ctxFetchId.current;
    const t = window.setTimeout(async () => {
      setCtxLoaded(false); // 异步回调内重置（同步置 false 会被 lint 判定为 effect 内 setState）
      try {
        const res = await fetch('/api/agent/context-stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: chat.messages,
            pageContext: serializePageContext(),
            ...(boundAgentId ? { agentId: boundAgentId } : {}),
          }),
        });
        if (ctxFetchId.current !== id) return; // 过期响应丢弃
        const json = (await res.json()) as { ok?: boolean; stats?: ContextStatsPayload };
        setCtxLoaded(true);
        if (json.ok && json.stats) setCtxStats(json.stats);
      } catch {
        setCtxLoaded(true);
        /* 统计失败不打断对话 */
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [chat.messages, context, boundAgentId]);

  // 主 Agent 实时动作 → 全局 liveActivity（topbar/orb/心跳共用）
  useEffect(() => {
    if (status === 'streaming' || status === 'submitted') {
      const act = deriveLiveActivity(messages, pendingL2);
      setLiveActivity(act.kind === 'idle' ? { kind: 'thinking', text: '正在思考…' } : act);
    } else if (state === 'consensus') {
      setLiveActivity({ kind: 'consensus', text: '共识投票中' });
    } else {
      setLiveActivity({ kind: 'idle', text: '' });
    }
  }, [messages, status, state, pendingL2, setLiveActivity]);

  // 主内容挤压的数值代理：让 margin 可以被 GSAP 平滑补间（而非瞬时 set）。
  // sidebar 态 = aside 实际宽度；stage/dock 态 = 0（stage 是覆盖 + scrim，不需挤压）。
  const marginProxy = useRef({ v: 0 });

  // ── 三面一体表面交换：单一 GSAP timeline 统一协调 ────────────────────────
  // aside 淡入/淡出 + width + main 挤压(margin) + FLIP ghost 全部放进同一 timeline，
  // 原子化同步做到丝滑；dock 态由 React 的 invisible 铁保底（杜绝残留），
  // 收起动画由 ghost 收拢主导，不依赖 aside 本体可见性。
  const animateSurface = (prev: AgentSurface, next: AgentSurface) => {
    const aside = asideRef.current;
    const ghost = ghostRef.current;
    const column = document.getElementById('app-main')?.parentElement ?? null;
    if (!aside || !ghost || !column) return;
    const vw = window.innerWidth;
    const proxy = marginProxy.current;
    gsap.killTweensOf([aside, ghost, proxy]);

    const setMargin = () => gsap.set(column, { marginRight: proxy.v });
    const push = next === 'sidebar'; // sidebar 挤压；stage/dock 归零
    const nextWidth = next === 'stage' ? stageW : drawerWidth;

    if (reduce) {
      gsap.set(aside, { xPercent: next === 'dock' ? 110 : 0, x: 0, opacity: 1, width: nextWidth });
      gsap.set(ghost, { opacity: 0 });
      const rChat = chatColRef.current;
      const rCanvas = stagePaneRef.current;
      if (rChat) gsap.set(rChat, { width: next === 'stage' ? CHAT_W : drawerWidth });
      if (rCanvas) gsap.set(rCanvas, { width: next === 'stage' ? stageW - CHAT_W : 0, opacity: next === 'stage' ? 1 : 0 });
      proxy.v = push ? nextWidth : 0;
      setMargin();
      return;
    }

    if (next === 'dock') {
      // 收起：aside 淡出 + margin 归零；ghost 收拢回岛锚点（主导动画，不依赖 aside 可见性）
      const w = aside.offsetWidth;
      const panelRect: MorphRect = { left: vw - w, top: 0, width: w, height: window.innerHeight };
      gsap
        .timeline()
        .to(aside, { x: 56, opacity: 0, duration: 0.22, ease: 'power2.in' }, 0)
        .to(proxy, { v: 0, duration: 0.35, ease: 'expo.out', onUpdate: setMargin }, 0);
      gsap.set(ghost, {
        left: panelRect.left, top: panelRect.top,
        width: panelRect.width, height: panelRect.height,
        x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 0, borderRadius: 0,
      });
      morphGhost(ghost, islandAnchorRect(), panelRect, {
        reverse: true,
        onComplete: () => {
          gsap.set(aside, { xPercent: 110, x: 0, opacity: 1 });
          gsap.set(ghost, { opacity: 0 });
          gsap.set(column, { marginRight: 0 });
        },
      });
      return;
    }

    // 展开 / 切换（sidebar / stage）
    gsap.set(aside, { xPercent: 0 });
    const chat = chatColRef.current;
    const canvas = stagePaneRef.current;
    if (prev === 'dock') {
      // 打开：aside 淡入 + 宽度补间 + margin 挤压 + ghost 从岛位生长
      gsap
        .timeline()
        .fromTo(
          aside,
          { x: 48, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.4, ease: 'power3.out', delay: 0.06 },
          0,
        )
        .to(aside, { width: nextWidth, duration: 0.5, ease: 'expo.out' }, 0)
        .to(proxy, { v: push ? nextWidth : 0, duration: 0.5, ease: 'expo.out', onUpdate: setMargin }, 0);
      // 分栏初始落位：对话列占满 aside（sidebar）或固定 CHAT_W（stage）；画布按需折叠/展开
      if (chat) gsap.set(chat, { width: next === 'stage' ? CHAT_W : nextWidth });
      if (canvas) gsap.set(canvas, { width: next === 'stage' ? stageW - CHAT_W : 0, opacity: next === 'stage' ? 1 : 0 });
      const dockRect = takeDockRect();
      if (dockRect) {
        const panelRect: MorphRect = { left: vw - nextWidth, top: 0, width: nextWidth, height: window.innerHeight };
        gsap.set(ghost, {
          left: panelRect.left, top: panelRect.top,
          width: panelRect.width, height: panelRect.height,
          x: 0, y: 0, opacity: 0,
        });
        morphGhost(ghost, dockRect, panelRect, {
          onComplete: () => gsap.set(ghost, { opacity: 0 }),
        });
      }
    } else {
      // sidebar ↔ stage：aside 变宽变窄 + margin + 内部分栏（对话列 ⇄ 画布）同一 timeline 原子化同步。
      // 宽度全部由 GSAP 补间（不靠 CSS flex↔fixed 类切换），确保侧栏/舞台互切丝滑不跳变、无溢出。
      gsap.set(aside, { x: 0, opacity: 1 });
      const toChatW = next === 'stage' ? CHAT_W : drawerWidth;
      const toCanvasW = next === 'stage' ? stageW - CHAT_W : 0;
      const tl = gsap.timeline();
      tl.to(aside, { width: nextWidth, duration: 0.5, ease: 'expo.out' }, 0)
        .to(proxy, { v: push ? nextWidth : 0, duration: 0.5, ease: 'expo.out', onUpdate: setMargin }, 0);
      if (chat) tl.to(chat, { width: toChatW, duration: 0.5, ease: 'expo.out' }, 0);
      if (canvas) tl.to(canvas, { width: toCanvasW, opacity: next === 'stage' ? 1 : 0, duration: 0.5, ease: 'expo.out' }, 0);
    }
  };

  // surface 变化 → 统一协调动画；窗口 resize 舞台（surface 不变但 effectiveWidth 变）→ 补间宽度+margin。
  // 松手吸附（drawerWidth 变、resizing 变 false）同样走 width+margin 补间，保持丝滑。
  useEffect(() => {
    const prev = prevSurfaceRef.current;
    if (surface !== prev) {
      prevSurfaceRef.current = surface;
      animateSurface(prev, surface);
    } else if (!resizing && surface !== 'dock') {
      animateSurface(surface, surface);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, effectiveWidth, resizing, reduce]);

  // dashboard 沉浸式：面板不渲染，main 的 margin 必须归零，否则被之前挤压残留推开。
  useEffect(() => {
    if (!dashboardImmersive) return;
    const column = document.getElementById('app-main')?.parentElement ?? null;
    if (!column) return;
    gsap.killTweensOf(marginProxy.current);
    gsap.set(column, { marginRight: 0 });
  }, [dashboardImmersive]);

  // dashboard 沉浸式收拢卸载门：进入时保留面板一个动画周期（ghost 收拢 0.4s + 淡入 0.12s），
  // 期间 surface 已强制为 dock，收拢动画照常播放；动画结束后才置位卸载。离开时复位（下轮进入再播）。
  // 延迟用 setTimeout 回调触发 setState，避免在 effect 体内同步 setState 引起级联渲染。
  useEffect(() => {
    const t = window.setTimeout(
      () => setImmersiveExited(dashboardImmersive),
      dashboardImmersive ? 600 : 0,
    );
    return () => window.clearTimeout(t);
  }, [dashboardImmersive]);

  // 拖动即时跟随兜底：resizing 期间 margin 与 aside 实时宽度同步。
  // 动画期（非 resizing）margin 由 timeline 驱动，二者不冲突。
  useEffect(() => {
    const column = document.getElementById('app-main')?.parentElement ?? null;
    const aside = asideRef.current;
    if (!column || !aside) return;
    const apply = () => {
      if (!resizing) return;
      gsap.killTweensOf(marginProxy.current);
      gsap.set(column, { marginRight: aside.offsetWidth });
      // 拖动改宽（sidebar）时对话列跟随 aside 实时占满，画布保持折叠 0
      const chat = chatColRef.current;
      if (chat && surface === 'sidebar') gsap.set(chat, { width: aside.offsetWidth });
    };
    const ro = new ResizeObserver(apply);
    ro.observe(aside);
    return () => ro.disconnect();
  }, [resizing, surface, dashboardImmersive]);

  // 挂载：初始定位（dock 态藏于屏外；宽度由 GSAP 独占写入）。
  // useLayoutEffect：在首帧绘制前把面板挪出屏外，避免收起态闪现一帧。
  useLayoutEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    gsap.killTweensOf(aside, 'width,x,xPercent,opacity');
    gsap.set(aside, { width: effectiveWidth, xPercent: 110, x: 0, opacity: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 恢复记忆宽度（仅 useEffect 读 localStorage，避免 SSR hydration 不匹配）
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(DRAWER_RESIZE_KEY));
      if (Number.isFinite(saved) && saved >= MIN_W && saved <= EXPANDED_W) {
        setDrawerWidth(saved);
      }
    } catch { /* 忽略存储异常 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 可拖宽把手：pointerdown 记录起点，move 实时改宽度，up 收敛到最近档位并记忆。
  // 拖动用 setPointerCapture 保证指针移出抽屉仍持续跟随；位移 <8px 视为误触忽略。
  // 拖动期间关 width transition（即时跟手），松手恢复平滑过渡；舞台态锁定，改走「回到侧栏」。
  function onResizePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (reduce || !drawerOpen || stageOpen) return;
    const startX = e.clientX;
    const startW = drawerWidth;
    const handle = e.currentTarget as HTMLElement | null;
    // setPointerCapture 在无活动指针（如程序化/合成 PointerEvent）时会抛
    // "No active pointer"，必须在捕获失败时优雅降级为全局监听，不能中断拖拽。
    let captured = false;
    try {
      handle?.setPointerCapture?.(e.pointerId);
      captured = true;
    } catch {
      captured = false;
    }
    setResizing(true);
    const column = document.getElementById('app-main')?.parentElement ?? null;
    const onMove = (ev: PointerEvent) => {
      const w = clampWidth(startW - (ev.clientX - startX));
      setDrawerWidth(w);
      // 拖动即时跟手：aside 宽度与 main 挤压同步写入（动画期由 timeline 驱动，互不冲突）
      const aside = asideRef.current;
      if (aside) gsap.set(aside, { width: w });
      if (column) gsap.set(column, { marginRight: w });
    };
    const onUp = (ev: PointerEvent) => {
      const moved = ev.clientX - startX;
      if (captured) {
        try {
          handle?.releasePointerCapture?.(ev.pointerId);
        } catch { /* 指针已失效，忽略 */ }
      }
      // 任何位移都落位到最近档位（不再设 8px 阈值，微调也可用；未动=moved≈0 → 同档位无变化）
      commitWidth(startW - moved);
      setResizing(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    e.preventDefault();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: false });
  }
  function clampWidth(w: number): number {
    const vwMax = typeof window !== 'undefined' ? Math.min(window.innerWidth - 96, MAX_W) : MAX_W;
    return Math.round(Math.min(Math.max(w, MIN_W), Math.max(vwMax, MIN_W)));
  }
  function commitWidth(w: number) {
    // 越过 MAX + 阈值 → 进入「展开」全宽画布；否则 snap 到最近档位
    const clamped = clampWidth(w);
    const next = clamped >= EXPANDED_W - 48 ? EXPANDED_W : nearestSnap(clamped);
    setDrawerWidth(next);
    try { localStorage.setItem(DRAWER_RESIZE_KEY, String(next)); } catch { /* ignore */ }
  }
  function nearestSnap(w: number): number {
    return SNAP_STEPS.reduce((best, s) => (Math.abs(s - w) < Math.abs(best - w) ? s : best), SNAP_STEPS[0]);
  }

  // ESC 关闭：先退舞台（回贴边列）、再退抽屉，逐级收起不跳级
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (stageOpen) setSurface('sidebar');
      else setSurface('dock');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, stageOpen, setSurface]);

  // Agent 命令总线：任意 UI 按钮（能力中心/工作台/灵动岛气泡）sendAgentCommand(prompt) →
  // 打开侧栏 + 立即把任务送入对话，由主 Agent 编排执行（人在环中：L2 确认门 / 组件渲染 / 页面导航）。
  const pendingQueueRef = useRef<string[]>([]);
  useEffect(() => {
    // dashboard 沉浸式页：命令总线由 DashboardChat 接替，抽屉不参与，避免双发。
    if (dashboardImmersive) return;
    const sendRef = { fn: (text: string) => send(text) };
    const unsub = subscribeAgentCommand((cmd) => {
      // 已在任意面板形态时不打断当前面（stage 也能收命令），收起态则唤醒为侧栏
      if (!usePresence.getState().drawerOpen) setSurface('sidebar');
      // 命令落在下一帧再发送，保证抽屉打开后 transport 已就绪
      window.setTimeout(() => sendRef.fn(cmd.prompt), 120);
    });
    return () => {
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSurface]);

  // busy 时 send() 会静默丢弃：改为入队，空闲后自动补发（避免 UI 交棒的命令在流式执行中丢失）
  // 注意：busy 是 chat.status 派生（React 状态异步更新），同一渲染帧内连点多个按钮时 busy 仍为 false；
  // 因此叠加 streamBusyRef 同步护栏，保证「一次只跑一条流」，其余命令严格排队。
  useEffect(() => {
    if (busy || streamBusyRef.current) return;
    const q = pendingQueueRef.current.shift();
    if (q) {
      // 等一帧再发，避免与刚结束的流式渲染竞争
      const t = window.setTimeout(() => send(q), 150);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  // AI-Native 对话历史：挂载时恢复上次会话（或新建），会话消息回到消息流
  useEffect(() => {
    if (convLoadedRef.current) return;
    convLoadedRef.current = true;
    void (async () => {
      const saved = localStorage.getItem(CONV_STORAGE_KEY);
      if (saved) {
        try {
          const res = await fetch(`/api/agent/conversations/${saved}`);
          const json = (await res.json()) as {
            success?: boolean;
            data?: { id: string; title: string; messages: Array<{ id: string; role: string; content: string }> };
          };
          if (json.success && json.data) {
            convIdRef.current = saved;
            setConvTitle(json.data.title || '新对话');
            chat.setMessages((json.data.messages ?? []).map(dbMessageToUI));
            void refreshConversations();
            return;
          }
        } catch { /* fallthrough → 新建 */ }
      }
      await createConversation();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    // 同步护栏优先：streamBusyRef 在同帧内立即置位，堵住「多条 sendMessage 并发」的竞态
    if (busy || streamBusyRef.current) {
      if (!pendingQueueRef.current.includes(q)) pendingQueueRef.current.push(q);
      return;
    }
    streamBusyRef.current = true;
    pushTelemetry('选品 Agent', '提问 · ' + q.slice(0, 18));
    setLiveState('busy', 0.72);
    const p = chat.sendMessage({ text: q });
    if (p && typeof p.then === 'function') {
      p.catch(() => {
        streamBusyRef.current = false;
      });
    }
    setInput('');
  }

  // ── 会话历史（AI-Native 对话持久化）：新建 / 切换 / 恢复 ──────────────
  async function refreshConversations() {
    try {
      const res = await fetch('/api/agent/conversations');
      const json = (await res.json()) as { success?: boolean; data?: ConversationSummary[] };
      if (json.success) setConversations(json.data ?? []);
    } catch { /* 后端未就绪时忽略 */ }
  }

  async function createConversation(): Promise<string | null> {
    // 复用已存在的空白会话（title=新对话 且 0 条消息），避免每次新建堆积多个「新对话」
    try {
      const listRes = await fetch('/api/agent/conversations');
      const listJson = (await listRes.json()) as { success?: boolean; data?: ConversationSummary[] };
      const empty = (listJson.data ?? []).find(
        (c) => c.title === '新对话' && c.message_count === 0,
      );
      if (empty) {
        convIdRef.current = empty.id;
        localStorage.setItem(CONV_STORAGE_KEY, empty.id);
        setConvTitle('新对话');
        animatedMsgIdxRef.current = -1;
        chat.setMessages([]);
        void refreshConversations();
        return empty.id;
      }
    } catch { /* 列表不可用则直接新建 */ }
    try {
      const res = await fetch('/api/agent/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新对话' }),
      });
      const json = (await res.json()) as { success?: boolean; data?: ConversationSummary };
      if (json.success && json.data?.id) {
        convIdRef.current = json.data.id;
        localStorage.setItem(CONV_STORAGE_KEY, json.data.id);
        setConvTitle(json.data.title ?? '新对话');
        animatedMsgIdxRef.current = -1;
        chat.setMessages([]);
        void refreshConversations();
        return json.data.id;
      }
    } catch { /* 后端未迁移时降级为无持久化对话 */ }
    return null;
  }

  async function switchConversation(id: string) {
    try {
      const res = await fetch(`/api/agent/conversations/${id}`);
      const json = (await res.json()) as {
        success?: boolean;
        data?: { id: string; title: string; messages: Array<{ id: string; role: string; content: string }> };
      };
      if (json.success && json.data) {
        convIdRef.current = id;
        localStorage.setItem(CONV_STORAGE_KEY, id);
        setConvTitle(json.data.title || '新对话');
        animatedMsgIdxRef.current = -1;
        chat.setMessages((json.data.messages ?? []).map(dbMessageToUI));
        void refreshConversations();
      }
    } catch { /* 忽略 */ }
  }

  const stateLabel = state === 'consensus' ? '共识投票 · 投票中'
    : state === 'busy' ? '执行中'
    : '空闲';

  // 单条消息渲染（虚拟滚动与普通渲染共用）。外框携带 data-msg-idx 供 GSAP 入场定位。
  // 说明：本地函数内联在组件里以便闭包访问 messages/busy/pendingL2/resolveL2/send 等；
  // 纯渲染、无内部 state，虚拟行挂载/卸载无副作用。
  const renderMessage = (m: AgentUIMessage, idx: number) => (
    <div key={m.id} data-msg-idx={idx} className="mt-3">
      <div className="mb-1 font-mono text-tiny uppercase tracking-[0.08em] text-muted-foreground">
        {m.role === 'user' ? 'YOU' : 'AGENT · 锚定当前上下文'}
      </div>
      {m.parts.map((part, i) => {
        if (part.type === 'text') {
          const raw = part.text ?? '';
          // 流式开场常产出空/纯空白文本 part：跳过，避免渲染成空白框
          if (!raw.trim()) return null;
          const isLast = m.id === messages[messages.length - 1]?.id
            && i === m.parts.length - 1;
          return (
            <div
              key={i}
              className={cn(
                'mt-1 max-w-[94%] rounded-2xl px-3 py-2',
                m.role === 'user'
                  ? 'ml-auto rounded-br-md bg-primary/10 text-foreground'
                  : 'rounded-bl-md border border-border bg-muted/60 text-foreground',
              )}
            >
              <MarkdownMessage text={raw} streaming={busy && isLast && m.role === 'assistant'} />
              {busy && isLast && m.role === 'assistant' && (
                <span
                  aria-hidden
                  className="ml-0.5 inline-block h-3.5 w-[7px] animate-pulse-glow bg-primary align-[-2px]"
                />
              )}
            </div>
          );
        }
        if (part.type === 'dynamic-tool') {
          // 服务端业务/编排工具（product_research / plan_workflow / run_workflow /
          // deep_task / generate_page / memory_search / memory_store…）：渲染为工作流步骤卡，
          // 让 Agent 的编排动作在对话里真实可见。
          const toolName = part.toolName;
          const outputText =
            typeof part.output === 'string'
              ? part.output
              : part.output
                ? (() => {
                    try {
                      return JSON.stringify(part.output);
                    } catch {
                      return String(part.output);
                    }
                  })()
                : '';
          const streaming = part.state === 'input-streaming' || part.state === 'input-available';
          const done = part.state === 'output-available';
          const failed = part.state === 'output-error';
          return (
            <div key={part.toolCallId} className="mt-1.5">
              <div
                className={cn(
                  'flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-caption',
                  failed
                    ? 'border-danger/40 bg-danger/5'
                    : done
                      ? 'border-border bg-muted/40'
                      : 'border-primary/25 bg-primary/5',
                )}
              >
                {streaming ? (
                  <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-primary" />
                ) : failed ? (
                  <X className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                ) : (
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="shrink-0 font-mono font-semibold text-primary">
                      {toolName}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {failed ? '执行失败' : streaming ? '执行中…' : '执行完成'}
                    </span>
                  </div>
                  {(done || failed) && outputText.trim() && (
                    <div className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-all font-mono text-[11px] leading-snug text-muted-foreground">
                      {outputText.slice(0, 240)}
                      {outputText.length > 240 ? '…' : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }
        if (part.type === 'tool-ui_action') {
          const isPendingL2 = pendingL2.some((p) => p.toolCallId === part.toolCallId);
          const acted = part.input ? getActionById(String(part.input.id ?? '')) : undefined;
          const risk = riskLevelOf(acted);
          return (
            <div key={part.toolCallId} className="mt-1.5">
              {part.state === 'input-streaming' && (
                <Badge variant="secondary" className="gap-1 font-normal">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  解析 UI 动作…
                </Badge>
              )}
              {part.state === 'input-available' && isPendingL2 && (
                <Badge variant="warning" className="gap-1 font-normal">
                  <ShieldAlert className="h-3 w-3" />
                  待你确认 · {part.input?.id ?? '动作'}（L2）
                </Badge>
              )}
              {part.state === 'input-available' && !isPendingL2 && (
                <Badge variant="secondary" className="gap-1 font-normal">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {RISK_META[risk].label} · 执行 {part.input?.id ?? '动作'}…
                </Badge>
              )}
              {part.state === 'output-available' && !!part.output && (
                <Badge variant="success" className="gap-1 font-normal">
                  <Check className="h-3 w-3" />
                  {part.output}
                </Badge>
              )}
              {part.state === 'output-available' && !part.output && (
                <Badge variant="success" className="gap-1 font-normal">
                  <Check className="h-3 w-3" />
                  UI 动作完成
                </Badge>
              )}
              {part.state === 'output-error' && (
                <Badge variant="danger" className="gap-1 font-normal">
                  <X className="h-3 w-3" />
                  {part.errorText}
                </Badge>
              )}
            </div>
          );
        }
        if (part.type === 'tool-render_component') {
          const rendered =
            (part.state === 'input-available' || part.state === 'output-available') && part.input ? (
              // 组件随流出现：淡入 + 上移，让「生成组件」有渐进成型的观感
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                <GeneratedComponent
                  id={part.input.component}
                  props={part.input.props ?? {}}
                  onInteract={(answer) => {
                    // 交互组件（如 question）提交答案 → 作为下一条用户消息送回对话流，Agent 续推
                    const text = typeof answer === 'string' ? answer : JSON.stringify(answer);
                    if (text) send(text);
                  }}
                />
              </motion.div>
            ) : null;
          return (
            <div key={part.toolCallId} className="mt-1.5">
              {part.state === 'input-streaming' && (
                <ComponentSkeleton />
              )}
              {rendered}
              {part.state === 'output-error' && (
                <Badge variant="danger" className="gap-1 font-normal">
                  <X className="h-3 w-3" />
                  {part.errorText}
                </Badge>
              )}
            </div>
          );
        }
        // json-render Inline：data-spec part 携带 JSONL patches，编译成 spec 渲染 <Renderer>
        if (part.type === SPEC_DATA_PART_TYPE) {
          const isLast = m.id === messages[messages.length - 1]?.id;
          return (
            <JsonRenderMessageView
              key={part.type + i}
              parts={m.parts as DataPart[]}
              streaming={busy && isLast && m.role === 'assistant'}
              onInteract={(answer) => {
                const text = typeof answer === 'string' ? answer : JSON.stringify(answer);
                if (text) send(text);
              }}
            />
          );
        }
        return null;
      })}
    </div>
  );

  // header 状态标签动态化：liveActivity 非 idle 时直接显示「当前动作」，比静态 busy 文字更有信息量
  const dotStatus =
    liveActivity.kind === 'l2' ? 'warning'
    : liveActivity.kind === 'error' ? 'danger'
    : state === 'consensus' ? 'warning'
    : liveActivity.kind !== 'idle' || state === 'busy' ? 'info'
    : 'success';
  const headerLabel = liveActivity.kind !== 'idle' ? liveActivity.text : stateLabel;

  // 对话列（sidebar 单列 / stage 右栏共用同一份 JSX：会话条 → 活动横幅 → 软建议 → 消息流 → 输入区）
  const chatColumn = (
    <>
      {/* ── 会话历史（AI-Native）：新建 / 切换历史对话，对话不再一次性 ── */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 max-w-full gap-1.5 px-1.5 text-caption text-muted-foreground hover:text-foreground"
            >
              <MessageSquare className="h-3 w-3 shrink-0" />
              <span className="max-w-44 truncate">{convTitle}</span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom" className="w-64">
            <DropdownMenuItem onSelect={() => void createConversation()}>
              <Plus className="h-3.5 w-3.5 text-primary" />
              新建对话
            </DropdownMenuItem>
            {conversations.length > 0 && <DropdownMenuSeparator />}
            {conversations.slice(0, 20).map((c) => (
              <DropdownMenuItem
                key={c.id}
                onSelect={() => void switchConversation(c.id)}
                className="flex items-center gap-2"
              >
                <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                <span className="shrink-0 font-mono text-tiny text-muted-foreground">{c.message_count}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="新建对话"
              className="ml-auto h-6 w-6 shrink-0 text-muted-foreground"
              onClick={() => void createConversation()}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">新建对话</TooltipContent>
        </Tooltip>
      </div>

      {/* ── 实时活动横幅（钉住不随对话滚动）：让用户一眼知道 Agent 正在干嘛 ── */}
      <AgentActivityBanner />

      {/* ── 舞台软建议：生成组件已落地且处于贴边列时，轻提示可全宽查看（建议但不由你） ── */}
      {!stageOpen && hasComponent && (
        <button
          type="button"
          onClick={() => setSurface('stage')}
          className="mx-4 mt-2 flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-primary/30 bg-primary/8 px-2.5 py-1.5 text-caption font-medium text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Maximize2 className="h-3 w-3 shrink-0" />
          组件已生成，展开全宽查看
        </button>
      )}

      {/* ── 对话流 ── */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4 py-3" aria-live="polite" ref={messagesListRef}>
          {/* 当前上下文锚 */}
          <div className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 font-mono text-caption text-primary">
            <Radar className="h-3 w-3 shrink-0" />
            <span className="truncate">
              当前上下文：{context.page}{context.selection ? ' · ' + context.selection : ''}
            </span>
          </div>

          {/* 上下文组成（默认收起）：占模型窗口百分比 + 各片段 token 构成 */}
          <div className="mt-2 overflow-hidden rounded-lg border border-border bg-muted/25">
            <button
              type="button"
              onClick={() => setCtxOpen((v) => !v)}
              className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-caption"
              aria-expanded={ctxOpen}
            >
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                  ctxOpen && 'rotate-180',
                )}
              />
              <span className="font-medium text-foreground">上下文占用</span>
              {ctxStats ? (
                <>
                  <span className="ml-auto font-mono text-tiny tabular-nums text-muted-foreground">
                    ≈{formatTokens(ctxStats.total)} / {formatTokens(ctxStats.window)}
                  </span>
                  <span className={cn('rounded px-1.5 py-0.5 font-mono text-tiny font-semibold', pctTone(ctxStats.pct))}>
                    {ctxStats.pct}%
                  </span>
                </>
              ) : ctxLoaded ? (
                <span className="ml-auto text-tiny text-muted-foreground">暂无对话</span>
              ) : (
                <span className="ml-auto text-tiny text-muted-foreground">估算中…</span>
              )}
            </button>

            {ctxOpen && (
              <div className="border-t border-border/60 px-2.5 py-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${Math.min(100, ctxStats?.pct ?? 0)}%`,
                      background: (ctxStats?.pct ?? 0) >= 80 ? 'var(--danger)' : 'var(--primary)',
                    }}
                  />
                </div>
                <ul className="mt-2 space-y-1.5">
                  {(ctxStats?.breakdown ?? []).map((b) => (
                    <li key={b.key} className="flex items-center gap-2 text-tiny">
                      <span className="w-16 shrink-0 truncate text-muted-foreground">{b.label}</span>
                      <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary/40"
                          style={{ width: `${Math.min(100, b.pct)}%` }}
                        />
                      </span>
                      <span className="w-12 shrink-0 text-right font-mono tabular-nums text-muted-foreground">
                        {formatTokens(b.tokens)}
                      </span>
                      <span className="w-10 shrink-0 text-right font-mono tabular-nums text-muted-foreground">
                        {b.pct}%
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-tiny leading-relaxed text-muted-foreground/70">
                  ≈ 启发式估算（非模型精确分词）；窗口来自 {ctxStats?.window ? formatTokens(ctxStats.window) : '模型'} tokens
                  {ctxStats && ctxStats.pct >= 80 ? ' · 已接近上限，建议精简对话或开启新会话' : ''}
                </p>
              </div>
            )}
          </div>

          {messages.length === 0 && !chat.error && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              就当前页面提问…Agent 可以直接操作页面：筛选、跳转、高亮卡片、打开面板。
            </p>
          )}

          {/* 消息流：长会话走虚拟滚动（按需渲染视口内消息），否则普通渲染（保流式/GSAP 原味） */}
          {virtualize ? (
            <div ref={virtualScrollRef} className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
              {rowVirtualizer.getVirtualItems().map((vi) => (
                <div
                  key={vi.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={vi.index}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${vi.start}px)` }}
                >
                  {renderMessage(messages[vi.index], vi.index)}
                </div>
              ))}
            </div>
          ) : (
            messages.map((m, idx) => renderMessage(m, idx))
          )}

          {/* L2 人在环中确认卡：对外/不可逆动作必须当次明确批准 */}
          {pendingL2.map((p) => (
            <div
              key={p.toolCallId}
              data-testid="l2-confirm-card"
              className="mt-2 rounded-xl border border-warning/40 bg-warning/5 p-3"
            >
              <div className="flex items-center gap-1.5 text-caption font-semibold text-warning">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                需要你批准 · L2 对外动作
              </div>
              <div className="mt-1 break-all font-mono text-caption text-muted-foreground">{p.actionId}</div>
              <p className="mt-1.5 text-xs leading-5 text-foreground">{p.explain}</p>
              <div className="mt-2.5 flex gap-2">
                <Button
                  size="sm"
                  data-testid="l2-approve"
                  className="h-7 flex-1 gap-1 text-xs"
                  onClick={() => resolveL2(p.toolCallId, true)}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  批准执行
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="l2-reject"
                  className="h-7 flex-1 text-xs"
                  onClick={() => resolveL2(p.toolCallId, false)}
                >
                  取消
                </Button>
              </div>
            </div>
          ))}

          {chat.error && (
            <p className="mt-2 text-xs leading-relaxed text-destructive">
              {/AI_CONFIG/i.test(chat.error.message)
                ? `${chat.error.message} —— 路径:设置 → AI 配置,填入 API Key 后重试。`
                : chat.error.message || '网络异常,请稍后重试'}
            </p>
          )}

          {/* 遥测 */}
          <div className="mt-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="text-caption text-muted-foreground">Agent 遥测(实时)</div>
              {liveActivity.kind !== 'idle' && (
                <span className="flex items-center gap-1 font-mono text-[10px] text-primary">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> 实时
                </span>
              )}
            </div>
            <ul aria-live="polite" className="mt-1.5">
              {telemetry.length === 0 && (
                <li className="py-1.5 text-caption text-muted-foreground">暂无事件</li>
              )}
              {telemetry.map((t, idx) => (
                <li key={t.id}>
                  <div className="flex items-center gap-2 py-1.5 text-caption">
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground/50">
                      {new Date(t.ts).toLocaleTimeString('zh-CN', { hour12: false })}
                    </span>
                    <span className={cn('shrink-0 font-mono', t.agent.includes('深度子代理') ? 'text-wf-imaging' : 'text-primary')}>
                      {t.agent}
                    </span>
                    <span className="truncate text-muted-foreground">{t.text}</span>
                  </div>
                  {idx < telemetry.length - 1 && <Separator />}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ScrollArea>

      {/* ── 输入区 ── */}
      <footer className="flex items-center gap-2 border-t border-border bg-card/60 px-4 py-3">
        <Input
          aria-label="就当前上下文提问"
          placeholder={busy ? '生成中…' : '就当前上下文提问,回答锚定在此处…'}
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && input.trim() && !busy) send(input); }}
          className="h-9 flex-1 text-xs"
        />
        <Button
          aria-label={busy ? '生成中' : '发送'}
          size="icon"
          disabled={busy}
          onClick={() => { if (input.trim() && !busy) send(input); }}
          className="h-9 w-9 shrink-0"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
        </Button>
      </footer>
    </>
  );

  // dashboard 沉浸式对话画布：不渲染三面一体面板（hooks 已全部执行，此处短路渲染）。
  // 进入 dashboard 时先保留面板一个动画周期（收拢动画由 immersiveExited 门控），避免直接消失。
  if (dashboardImmersive && immersiveExited) return null;

  return (
    <>
      {/* 舞台全屏 scrim：半透明+轻模糊透出页面上下文；点击退回侧栏。
          常驻挂载（不随开合闪卸），visibility 过渡保证隐藏态不拦截交互。 */}
      <button
        ref={scrimRef}
        type="button"
        aria-label="退出舞台"
        tabIndex={stageOpen ? 0 : -1}
        onClick={() => setSurface('sidebar')}
        className={cn(
          'fixed inset-0 z-[27] bg-background/55 backdrop-blur-[2px] transition-[opacity,visibility] duration-300 ease-out',
          stageOpen ? 'visible opacity-100' : 'invisible opacity-0',
        )}
      />

      {/* FLIP 幽灵：岛 ⇄ 面板的形变桥（纯装饰、不承接交互，缩放不扭曲内容） */}
      <div
        ref={ghostRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[29] rounded-2xl border border-border bg-card/95 shadow-2xl"
        style={{ width: 0, height: 0, opacity: 0, willChange: 'transform, opacity, border-radius' }}
      />

      <aside
        ref={asideRef}
        aria-label="Agent 面板"
        className={cn(
          // min-w-0：固定定位 + 宽度由 GSAP 补间（drawerWidth/stageW）控制。
          // flex 容器子元素默认 min-width:auto，会被对话内容/组件的 min-content 撑开，
          // 导致抽屉实际宽度 > 目标档位，而 main 只按 drawerWidth 挤压 → 抽屉覆盖在内容上
          // （表现为「展开到最大 + 不挤压 main」，拖动后才对齐）。min-w-0 让 GSAP 宽度真正生效。
          'fixed inset-y-0 right-0 z-[28] flex min-w-0 flex-col border-l border-border bg-card/90 shadow-2xl',
          // backdrop-blur 在「面板宽度被 GSAP 逐帧补间」时会让浏览器每帧重采样背后像素做高斯模糊，
          // 加上 markdown 大 DOM 一起就是拖拽/切舞台卡顿的 GPU 主因。拖动改宽期间临时关闭 blur、
          // 用更高不透明实底替代，拖拽过程视觉无感、帧率显著提升；松手恢复玻璃质感。
          !resizing && 'backdrop-blur-xl',
          resizing && 'bg-card/95',
          // surface 为 dock 时强制不可见、不可交互（以 React 状态为唯一真源）。
          // 抽屉显隐原本只靠一次性 GSAP transform 补间，路由切换打断动画时可能把 aside 残留为可见态
          // （surface=dock 但抽屉仍显示、且因 drawerOpen=false 无法拖动）。这里声明式兜底：
          // dock 态一律隐藏，灵动感由独立的 FLIP ghost（ghostRef）形变保留，不依赖 aside 本体位置。
          surface === 'dock' && 'invisible pointer-events-none',
        )}
      >
        {/* 可拖宽把手（抽屉左缘）：拖动改宽，双击回默认档；舞台态锁定（改走模式切换器） */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="调整面板宽度"
          onPointerDown={onResizePointerDown}
          onDoubleClick={() => { setDrawerWidth(DEFAULT_W); try { localStorage.setItem(DRAWER_RESIZE_KEY, String(DEFAULT_W)); } catch { /* ignore */ } }}
          className={cn(
            // 命中区加宽到 16px 并完整落在抽屉左缘内侧（不 left 悬出），真实鼠标才好点中；
            // 内嵌一条明显竖线 + hover/active 变主色，提示"可拖"。resize 逻辑本身不依赖此尺寸。
            'absolute left-0 top-0 z-10 h-full w-4 cursor-col-resize',
            'group touch-none select-none',
            reduce && 'hidden',
          )}
        >
          <span className="absolute inset-y-0 left-0 w-1.5 translate-x-1 rounded-full bg-border/60 transition-colors group-hover:bg-primary/70 group-active:bg-primary" />
        </div>

        {/* ── Header：身份 + 三面一体模式切换器（岛/栏/台一键直达） ── */}
        <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Radar className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="text-body font-bold leading-tight text-foreground">
              Agent 助手
              {surface === 'stage' && (
                <span className="ml-1.5 align-middle text-caption font-medium text-wf-imaging">· 舞台</span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 font-mono text-caption text-muted-foreground">
              <StatusDot status={dotStatus} pulse={liveActivity.kind !== 'idle' || state !== 'idle'} size="sm" />
              <span className="truncate">{headerLabel}</span>
            </div>
          </div>
          <div
            role="group"
            aria-label="Agent 面板形态"
            className="ml-auto flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted/30 p-0.5"
          >
            {SURFACE_MODES.map((m) => (
              <Tooltip key={m.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-pressed={surface === m.id}
                    aria-label={m.label}
                    onClick={() => setSurface(m.id)}
                    className={cn(
                      'flex h-7 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      surface === m.id
                        ? 'bg-primary/12 text-primary shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    <m.icon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">{m.label}（Esc 逐级收起）</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </header>

        {/* 面板主体：sidebar = 对话单列；stage = 左栏仪表盘动态画布 + 右栏对话（同一份 chatColumn）。
            stage 分栏宽度由 GSAP 与 aside 同一 timeline 协调（见 animateSurface）：对话列固定 CHAT_W，
            画布 = aside - CHAT_W。不用 flex↔fixed 类切换 + CSS transition，避免两者速率不一导致的
            瞬时跳变/溢出错乱；拖动改宽（sidebar）时画布折叠为 0、对话列跟随 aside 由 ResizeObserver 同步。 */}
        <div className="flex min-h-0 min-w-0 flex-1">
          {drawerOpen && (
            <section
              ref={stagePaneRef}
              aria-label="Agent 仪表盘动态画布"
              className="flex min-w-0 shrink-0 flex-col overflow-hidden border-r border-border"
              style={{ width: 0, opacity: 0 }}
            >
              <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-4">
                <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-wf-imaging" />
                <span className="shrink-0 text-caption font-semibold text-foreground">Agent 仪表盘 · 动态画布</span>
                {canvasCount > 0 && (
                  <Badge variant="secondary" className="h-5 shrink-0 px-1.5 font-mono text-tiny">{canvasCount}</Badge>
                )}
                <span className="ml-auto min-w-0 truncate text-tiny text-muted-foreground">Agent 生成组件经 panel.pin 实时上墙</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-3">
                <DashboardCanvas />
              </div>
            </section>
          )}
          {/* 对话列：舞台/侧栏通用；宽度由 GSAP 与 aside 协调（sidebar = 占满 aside，stage = CHAT_W） */}
          <section ref={chatColRef} className="flex min-w-0 shrink-0 flex-col">
            {chatColumn}
          </section>
        </div>
      </aside>
    </>
  );
}
