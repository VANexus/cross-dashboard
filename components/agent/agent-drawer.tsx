// components/agent/agent-drawer.tsx
'use client';
// 右侧 Agent 抽屉：唯一的对话面。
// ai@7 useChat（transport → /api/agent/chat，请求体带动态 pageContext）：
// token 级流式文本 + ui_action client tool 本地执行（按 id 路由 → zod 校验 → execute → addToolResult 回传统推）。
// 打开时 framer-motion 把主内容(#app-main 父列)真实挤压缩排；问答锚定 presence.context；球状态经 setLiveState 联动。
// 视觉遵循 FlowMind 设计 token（globals.css），骨架件复用 components/ui，动画统一 framer-motion。
import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2, Radar, SendHorizontal, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import type { UseChatHelpers } from '@ai-sdk/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import type { UIDataTypes, UIMessage } from 'ai';
import { z } from 'zod';
import { usePresence } from '@/stores/agent-presence';
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
import { componentDefs, GeneratedComponent } from '@/components/agent/generated';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusDot } from '@/components/ui/status-dot';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const DRAWER_W = 368;
const EASE = [0.16, 1, 0.3, 1] as const; // 对齐 --ease-out

/** ui_action client tool 契约：服务端暴露同名无 execute 工具（inputSchema { id, params? }），
 *  前端收到 tool call 后按 id 路由到本地 UIActionDef.execute 执行，结果经 addToolResult 回传触发续推。 */
export interface UiActionInput {
  id: string;
  params?: Record<string, unknown>;
}
/** render_component client tool 契约：白名单组件 + 已过 zod 校验的 props，前端查表渲染。 */
export interface RenderComponentInput {
  component: string;
  props?: Record<string, unknown>;
}
export type AgentUIMessage = UIMessage<
  unknown,
  UIDataTypes,
  {
    ui_action: { input: UiActionInput; output: string };
    render_component: { input: RenderComponentInput; output: string };
  }
>;

const uiActionInputSchema = z.object({
  id: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

const renderComponentInputSchema = z.object({
  component: z.string().min(1),
  props: z.record(z.string(), z.unknown()).optional(),
});

/** L2 动作挂起项：模型已发起、等待用户在确认卡上当次批准/取消。 */
interface PendingL2 {
  toolCallId: string;
  actionId: string;
  params: Record<string, unknown>;
  explain: string;
}

export function AgentDrawer() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const drawerOpen = usePresence((s) => s.drawerOpen);
  const setDrawerOpen = usePresence((s) => s.setDrawerOpen);
  const state = usePresence((s) => s.state);
  const telemetry = usePresence((s) => s.telemetry);
  const context = usePresence((s) => s.context);
  const pushTelemetry = usePresence((s) => s.pushTelemetry);
  const setLiveState = usePresence((s) => s.setLiveState);
  const [input, setInput] = useState('');
  const helpersRef = useRef<UseChatHelpers<AgentUIMessage> | null>(null);
  const messagesRef = useRef<AgentUIMessage[]>([]);

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
  useEffect(() => {
    let cancelled = false;
    whenKernelReady()
      .then((kernel) => {
        if (cancelled) return;
        kernel.actions.registerGlobalActions(
          createGlobalActions({
            onNavigate: (route) => router.push(route),
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
  }, [router]);

  // transport 指向 /api/agent/chat；body 每次发送时求值：从 presence store 取当前页面上下文
  const transport = useMemo(
    () =>
      new DefaultChatTransport<AgentUIMessage>({
        api: '/api/agent/chat',
        body: () => {
          const pageContext = serializePageContext();
          return pageContext ? { pageContext } : {};
        },
      }),
    [],
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
    onError: () => setLiveState('idle', 0.12),
    onFinish: ({ isError }) => {
      setLiveState('idle', 0.12);
      pushTelemetry('选品 Agent', isError ? '回答中断' : '就地回答完成 ✓');
    },
  });
  // useChat 官方模式:每次渲染后经 effect 刷新 ref,保证 onToolCall 闭包取到最新 helpers/messages
  useEffect(() => {
    helpersRef.current = chat;
    messagesRef.current = chat.messages;
  });

  const messages = chat.messages;
  const status = chat.status;
  const busy = status === 'streaming' || status === 'submitted';

  // 主内容挤压(与滑入同一补间)：framer animate() 命令式驱动 #app-main 父列 marginRight。
  // 压列 + 列已 min-w-0 才是真收缩（直接压 main 不参与水平 flex 分配）。
  useEffect(() => {
    const column = document.getElementById('app-main')?.parentElement ?? null;
    if (!column) return;
    if (reduce) {
      column.style.marginRight = drawerOpen ? `${DRAWER_W}px` : '0px';
      return;
    }
    const controls = animate(
      column,
      { marginRight: drawerOpen ? DRAWER_W : 0 },
      { duration: 0.45, ease: EASE },
    );
    return () => controls.stop();
  }, [drawerOpen, reduce]);

  // ESC 关闭
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, setDrawerOpen]);

  function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    pushTelemetry('选品 Agent', '就地提问 · ' + q.slice(0, 18));
    setLiveState('busy', 0.72);
    void chat.sendMessage({ text: q });
    setInput('');
  }

  const stateLabel = state === 'consensus' ? '共识投票 · 投票中'
    : state === 'busy' ? '流式执行中 · 湍流升高'
    : '空闲 · 与 RAK 网络协同';
  const dotStatus = state === 'consensus' ? 'warning' : state === 'busy' ? 'info' : 'success';

  return (
    <motion.aside
      aria-label="Agent 抽屉面板"
      initial={false}
      animate={{ x: drawerOpen ? '0%' : '110%' }}
      transition={reduce ? { duration: 0 } : { type: 'tween', duration: 0.45, ease: EASE }}
      className={cn(
        'fixed inset-y-0 right-0 z-[28] flex flex-col border-l border-border bg-card/90 shadow-2xl backdrop-blur-xl',
      )}
      style={{ width: DRAWER_W }}
    >
      {/* ── Header ── */}
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <Radar className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <div className="text-body font-bold leading-tight text-foreground">Agent 视域</div>
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-caption text-muted-foreground">
            <StatusDot status={dotStatus} pulse size="sm" />
            <span className="truncate">{stateLabel}</span>
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="收起抽屉"
              className="ml-auto h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setDrawerOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">收起抽屉 (Esc)</TooltipContent>
        </Tooltip>
      </header>

      {/* ── 对话流 ── */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4 py-3" aria-live="polite">
          {/* 当前上下文锚 */}
          <div className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 font-mono text-caption text-primary">
            <Radar className="h-3 w-3 shrink-0" />
            <span className="truncate">
              当前上下文：{context.page}{context.selection ? ' · ' + context.selection : ''}
            </span>
          </div>

          {messages.length === 0 && !chat.error && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              就当前页面提问…Agent 可以直接操作页面：筛选、跳转、高亮卡片、打开面板。
            </p>
          )}

          {messages.map((m) => (
            <div key={m.id} className="mt-3">
              <div className="mb-1 font-mono text-tiny uppercase tracking-[0.08em] text-muted-foreground">
                {m.role === 'user' ? 'YOU' : 'AGENT · 锚定当前上下文'}
              </div>
              {m.parts.map((part, i) => {
                if (part.type === 'text') {
                  const isLast = m.id === messages[messages.length - 1]?.id
                    && i === m.parts.length - 1;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'mt-1 max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed',
                        m.role === 'user'
                          ? 'ml-auto rounded-br-md bg-primary/10 text-foreground'
                          : 'rounded-bl-md border border-border bg-muted/60 text-foreground',
                      )}
                    >
                      {part.text}
                      {busy && isLast && m.role === 'assistant' && (
                        <span
                          aria-hidden
                          className="ml-0.5 inline-block h-3.5 w-[7px] animate-pulse-glow bg-primary align-[-2px]"
                        />
                      )}
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
                      {part.state === 'output-available' && (
                        <Badge variant="success" className="gap-1 font-normal">
                          <Check className="h-3 w-3" />
                          {part.output}
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
                      <GeneratedComponent id={part.input.component} props={part.input.props ?? {}} />
                    ) : null;
                  return (
                    <div key={part.toolCallId} className="mt-1.5">
                      {part.state === 'input-streaming' && (
                        <Badge variant="secondary" className="gap-1 font-normal">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          生成组件中…
                        </Badge>
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
                return null;
              })}
            </div>
          ))}

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
            <div className="text-caption text-muted-foreground">Agent 遥测(实时)</div>
            <ul aria-live="polite" className="mt-1.5">
              {telemetry.length === 0 && (
                <li className="py-1.5 text-caption text-muted-foreground">等待事件…</li>
              )}
              {telemetry.map((t, idx) => (
                <li key={t.id}>
                  <div className="flex items-center gap-2 py-1.5 text-caption">
                    <span className="shrink-0 font-mono text-primary">{t.agent}</span>
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
    </motion.aside>
  );
}
