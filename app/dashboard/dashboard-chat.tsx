'use client';
// app/dashboard/dashboard-chat.tsx
// 仪表盘对话核心（ChatGPT 式，沉浸式）：仪表盘页的整个 main body 就是这张对话画布。
// - 布局：居中对话列（消息流 flex-1 内滚 + 底部输入框固定），focus 画面中心；组件包在流内内联渲染。
// - 内核挂载：本组件独立挂载 client kernel（注册全局动作/白名单组件/测试缝），
//   并订阅 Agent 命令总线（dock 快捷项 → 中心对话）——dashboard 不依赖三面一体面板。
// 仅仪表盘页使用此「对话即画布」形态；其他页面维持三面一体设计。
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Check, Loader2, SendHorizontal, ShieldAlert, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import type { UseChatHelpers } from '@ai-sdk/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { SPEC_DATA_PART_TYPE } from '@json-render/core';
import type { DataPart } from '@json-render/react';
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
import { subscribeAgentCommand } from '@/lib/agent/agent-bus';
import {
  CONV_STORAGE_KEY,
  dbMessageToUI,
  deriveLiveActivity,
  renderComponentInputSchema,
  uiActionInputSchema,
  type AgentUIMessage,
  type PendingL2,
} from '@/lib/agent/chat-contract';
import { componentDefs, GeneratedComponent } from '@/components/agent/generated';
import { JsonRenderMessageView } from '@/components/agent/generated/json-render-view';
import { installGenUIActionRunner } from '@/lib/agent/genui/registry';
import { MarkdownMessage } from '@/components/agent/markdown-message';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** 空态欢迎示例：引导「组件生成 + 上墙」的核心玩法。 */
const WELCOME_CHIPS = [
  { label: '分析今日工作流', prompt: '分析今日工作流的运行情况，把趋势图放到仪表盘。' },
  { label: '生成竞品对比', prompt: '生成一张竞品对比组件，并固定到仪表盘。' },
  { label: '解读当前 KPI', prompt: '帮我分析一下当前运营总览的指标，给出改进建议。' },
];

/** 组件流式生成骨架（与抽屉同款观感）。 */
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

export function DashboardChat() {
  const pushTelemetry = usePresence((s) => s.pushTelemetry);
  const setLiveState = usePresence((s) => s.setLiveState);
  const setLiveActivity = usePresence((s) => s.setLiveActivity);
  const [input, setInput] = useState('');
  const [pendingL2, setPendingL2] = useState<PendingL2[]>([]);
  const helpersRef = useRef<UseChatHelpers<AgentUIMessage> | null>(null);
  const messagesRef = useRef<AgentUIMessage[]>([]);
  const streamBusyRef = useRef(false);
  const convLoadedRef = useRef(false);
  const pendingQueueRef = useRef<string[]>([]);
  const messagesListRef = useRef<HTMLDivElement>(null);
  const animatedMsgIdxRef = useRef(-1);

  // transport 单例（useState 惰性初始化：仅创建一次，body 每次发送时求值 conversationId/pageContext）
  const [transport] = useState(
    () =>
      new DefaultChatTransport<AgentUIMessage>({
        api: '/api/agent/chat',
        body: () => {
          const pageContext = serializePageContext();
          const payload: Record<string, unknown> = {};
          if (pageContext) payload.pageContext = pageContext;
          const cid = typeof window !== 'undefined' ? localStorage.getItem(CONV_STORAGE_KEY) : null;
          if (cid) payload.conversationId = cid;
          return payload;
        },
      }),
  );

  /** addToolResult 兜底：toolCallId 已不在消息树时不回传，避免 unhandledRejection。 */
  function safeAddToolResult(args: Parameters<NonNullable<UseChatHelpers<AgentUIMessage>['addToolResult']>>[0]) {
    const stillTracked = messagesRef.current.some((m) =>
      m.parts.some(
        (pt) =>
          (pt.type === 'tool-ui_action' || pt.type === 'tool-render_component') &&
          pt.toolCallId === args.toolCallId,
      ),
    );
    if (!stillTracked) return;
    try {
      const p = helpersRef.current?.addToolResult(args);
      if (p && typeof (p as Promise<unknown>).catch === 'function') {
        (p as Promise<unknown>).catch((err) => {
          console.warn('[dashboard-chat] addToolResult 未被消息树接收', err);
        });
      }
    } catch (err) {
      console.warn('[dashboard-chat] addToolResult 调用失败', err);
    }
  }

  /** 真正执行一个已通过校验/授权的动作，并把结果回传模型续推。 */
  function executeActionNow(toolCallId: string, action: UIActionDef, params: Record<string, unknown>) {
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

  /** 用户决策 L2：批准→执行；取消→以正常结果回传「未执行」。 */
  function resolveL2(toolCallId: string, approve: boolean) {
    const pending = pendingL2.find((p) => p.toolCallId === toolCallId);
    setPendingL2((prev) => prev.filter((p) => p.toolCallId !== toolCallId));
    if (!pending) return;
    if (!approve) {
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

  const chat = useChat<AgentUIMessage>({
    transport,
    sendAutomaticallyWhen: ({ messages }) =>
      lastAssistantMessageIsCompleteWithToolCalls({ messages }),
    onToolCall: ({ toolCall }) => {
      if (toolCall.dynamic) return;
      const failWith =
        (tool: 'ui_action' | 'render_component') =>
        (errorText: string) =>
          safeAddToolResult({ tool, toolCallId: toolCall.toolCallId, state: 'output-error', errorText });

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
          fail(`未注册的白名单组件：${parsed.data.component}（可用：${components.listComponents().map((d) => d.id).join(', ') || '无'}）`);
          return;
        }
        const pr = def.propsSchema.safeParse(parsed.data.props ?? {});
        if (!pr.success) {
          fail(`组件 ${def.id} props 不合法：${pr.error.message}`);
          return;
        }
        pushTelemetry('Agent', `动态渲染 · ${def.id}`);
        safeAddToolResult({ tool: 'render_component', toolCallId: toolCall.toolCallId, output: `已渲染组件 ${def.id}` });
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
        fail(`未注册的 UI 动作：${parsed.data.id}（当前可用：${getPageActions().map((a) => a.id).join(', ') || '无'}）`);
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
      if (riskLevelOf(action) === 'L2') {
        pushTelemetry('Agent', `L2 动作待批准 · ${action.id}`);
        const explain =
          typeof action.confirmText === 'function'
            ? action.confirmText(params)
            : action.confirmText ?? `动作「${action.id}」属于对外/不可逆操作（L2），执行后无法自动撤销，请确认是否继续。`;
        setPendingL2((prev) =>
          prev.some((p) => p.toolCallId === toolCall.toolCallId)
            ? prev
            : [...prev, { toolCallId: toolCall.toolCallId, actionId: action.id, params, explain }],
        );
        return;
      }
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
        const explain =
          typeof action.confirmText === 'function'
            ? action.confirmText(params)
            : action.confirmText ?? `动作「${id}」属于对外/不可逆操作（L2），执行后无法自动撤销，请确认是否继续。`;
        setPendingL2((prev) =>
          prev.some((p) => p.toolCallId === `genui-${id}`)
            ? prev
            : [...prev, { toolCallId: `genui-${id}`, actionId: id, params, explain }],
        );
        return;
      }
      executeActionNow(`genui-${id}-${Date.now()}`, action, params);
    });
  }, []);

  const messages = chat.messages;
  const status = chat.status;
  const busy = status === 'streaming' || status === 'submitted';

  // 会话恢复：与抽屉共享同一 CONV_STORAGE_KEY（同一持久化会话，两入口续接）。
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
            data?: { id: string; messages: Array<{ id: string; role: string; content: string }> };
          };
          if (json.success && json.data) {
            chat.setMessages((json.data.messages ?? []).map(dbMessageToUI));
            return;
          }
        } catch { /* fallthrough → 新建 */ }
      }
      try {
        const res = await fetch('/api/agent/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '新对话' }) });
        const json = (await res.json()) as { success?: boolean; data?: { id: string } };
        if (json.success && json.data?.id) {
          localStorage.setItem(CONV_STORAGE_KEY, json.data.id);
        }
      } catch { /* 后端未就绪时降级为无持久化对话 */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 内核挂载：注册全局动作 + 白名单组件 + 测试缝（dashboard 不依赖三面一体面板）。
  // 只有本组件（对话核心）在 dashboard 页负责挂载内核，drawer 在 /dashboard 已禁用。
  useEffect(() => {
    let cancelled = false;
    whenKernelReady()
      .then((kernel) => {
        if (cancelled) return;
        kernel.actions.registerGlobalActions(
          createGlobalActions({
            onNavigate: (route) => { window.location.href = route; },
            onRefresh: () => { window.location.reload(); },
          }),
        );
        installAgentTestHook();
        kernel.components.registerAll(componentDefs);
      })
      .catch((err) => {
        if (!cancelled) console.error('[dashboard-chat] 内核挂载失败', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Agent 命令总线：dock 快捷项 / 焦点气泡 → 中心对话（dashboard 版抽屉已禁用，本组件接替）。
  useEffect(() => {
    const sendRef = { fn: (text: string) => send(text) };
    const unsub = subscribeAgentCommand((cmd) => {
      window.setTimeout(() => sendRef.fn(cmd.prompt), 120);
    });
    return () => {
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
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

  // busy 后补发排队命令
  useEffect(() => {
    if (busy || streamBusyRef.current) return;
    const q = pendingQueueRef.current.shift();
    if (q) {
      const t = window.setTimeout(() => send(q), 150);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  // 实时动作 → 全局 liveActivity（灵动岛/聚焦气泡联动）
  useEffect(() => {
    if (status === 'streaming' || status === 'submitted') {
      const act = deriveLiveActivity(messages, pendingL2);
      setLiveActivity(act.kind === 'idle' ? { kind: 'thinking', text: '正在思考…' } : act);
    } else {
      setLiveActivity({ kind: 'idle', text: '' });
    }
  }, [messages, status, pendingL2, setLiveActivity]);

  // 新消息 GSAP 入场（y 上浮 + 淡入）
  useEffect(() => {
    const len = messages.length;
    if (len === 0 || len <= animatedMsgIdxRef.current) return;
    const idx = len - 1;
    const el = messagesListRef.current?.querySelector(`[data-msg-idx="${idx}"]`);
    if (el) {
      animatedMsgIdxRef.current = idx;
      gsap.fromTo(el, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' });
    }
  }, [messages.length]);

  const empty = messages.length === 0 && !chat.error;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── 消息流（ChatGPT 式：沉浸式居中列，正常文档流，随页面滚动）── */}
      <div className="relative min-h-0 flex-1">
        <div ref={messagesListRef} className="mx-auto w-full max-w-3xl px-4 py-6" aria-live="polite">
          {empty ? (
            /* 空态：居中欢迎（对话核心的仪式感） */
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/8">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-foreground">对话即仪表盘</h2>
              <p className="mt-1.5 max-w-md text-caption leading-relaxed text-muted-foreground">
                在正中间和 Agent 对话——它生成的图表、表格、指标会以图钉形式钉在画布右上角，
                仪表盘随对话实时生长。
              </p>
              <div className="mt-5 flex max-w-lg flex-wrap items-center justify-center gap-2">
                {WELCOME_CHIPS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => send(c.prompt)}
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-caption text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div key={m.id} data-msg-idx={idx} className="mt-5">
                {m.parts.map((part, i) => {
                  if (part.type === 'text') {
                    const raw = part.text ?? '';
                    if (!raw.trim()) return null;
                    const isLast = m.id === messages[messages.length - 1]?.id && i === m.parts.length - 1;
                    return m.role === 'user' ? (
                      // 用户：右对齐气泡
                      <div key={i} className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary/10 px-4 py-2.5 text-foreground">
                          <MarkdownMessage text={raw} />
                        </div>
                      </div>
                    ) : (
                      // Agent：ChatGPT 式全宽正文（无气泡）
                      <div key={i} className="text-foreground">
                        <MarkdownMessage text={raw} streaming={busy && isLast} />
                        {busy && isLast && (
                          <span aria-hidden className="ml-0.5 inline-block h-3.5 w-[7px] animate-pulse-glow bg-primary align-[-2px]" />
                        )}
                      </div>
                    );
                  }
                  if (part.type === 'dynamic-tool') {
                    // 服务端编排工具 → 紧凑步骤条
                    const toolName = part.toolName;
                    const outputText =
                      typeof part.output === 'string'
                        ? part.output
                        : part.output
                          ? (() => {
                              try { return JSON.stringify(part.output); } catch { return String(part.output); }
                            })()
                          : '';
                    const streaming = part.state === 'input-streaming' || part.state === 'input-available';
                    const done = part.state === 'output-available';
                    const failed = part.state === 'output-error';
                    return (
                      <div key={part.toolCallId} className="mt-2">
                        <div
                          className={cn(
                            'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-caption',
                            failed ? 'border-danger/40 bg-danger/5' : done ? 'border-border bg-muted/40' : 'border-primary/25 bg-primary/5',
                          )}
                        >
                          {streaming ? (
                            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
                          ) : failed ? (
                            <X className="h-3 w-3 shrink-0 text-destructive" />
                          ) : (
                            <Check className="h-3 w-3 shrink-0 text-primary" />
                          )}
                          <span className="shrink-0 font-mono font-semibold text-primary">{toolName}</span>
                          <span className="truncate text-muted-foreground">
                            {failed ? '执行失败' : streaming ? '执行中…' : '执行完成'}
                          </span>
                          {(done || failed) && outputText.trim() && (
                            <span className="ml-auto min-w-0 truncate font-mono text-[11px] text-muted-foreground">
                              {outputText.slice(0, 80)}{outputText.length > 80 ? '…' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }
                  if (part.type === 'tool-ui_action') {
                    const isPendingL2 = pendingL2.some((p) => p.toolCallId === part.toolCallId);
                    return (
                      <div key={part.toolCallId} className="mt-2">
                        {part.state === 'input-streaming' && (
                          <Badge variant="secondary" className="gap-1 font-normal">
                            <Loader2 className="h-3 w-3 animate-spin" /> 解析 UI 动作…
                          </Badge>
                        )}
                        {part.state === 'input-available' && isPendingL2 && (
                          <Badge variant="warning" className="gap-1 font-normal">
                            <ShieldAlert className="h-3 w-3" /> 待你确认 · {part.input?.id ?? '动作'}（L2）
                          </Badge>
                        )}
                        {part.state === 'input-available' && !isPendingL2 && (
                          <Badge variant="secondary" className="gap-1 font-normal">
                            <Loader2 className="h-3 w-3 animate-spin" /> 执行 {part.input?.id ?? '动作'}…
                          </Badge>
                        )}
                        {part.state === 'output-available' && !!part.output && (
                          <Badge variant="success" className="gap-1 font-normal">
                            <Check className="h-3 w-3" /> {part.output}
                          </Badge>
                        )}
                        {part.state === 'output-error' && (
                          <Badge variant="danger" className="gap-1 font-normal">
                            <X className="h-3 w-3" /> {part.errorText}
                          </Badge>
                        )}
                      </div>
                    );
                  }
                  if (part.type === 'tool-render_component') {
                    // 组件包：Agent 动态生成的组件直接渲染在对话流内（可被 pin 到状态栏）
                    const rendered =
                      (part.state === 'input-available' || part.state === 'output-available') && part.input ? (
                        <div className="mt-1 overflow-x-auto">
                          <GeneratedComponent
                            id={part.input.component}
                            props={part.input.props ?? {}}
                            onInteract={(answer) => {
                              const text = typeof answer === 'string' ? answer : JSON.stringify(answer);
                              if (text) send(text);
                            }}
                          />
                        </div>
                      ) : null;
                    return (
                      <div key={part.toolCallId} className="mt-2">
                        {part.state === 'input-streaming' && <ComponentSkeleton />}
                        {rendered}
                        {part.state === 'output-error' && (
                          <Badge variant="danger" className="gap-1 font-normal">
                            <X className="h-3 w-3" /> {part.errorText}
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
            ))
          )}

          {/* L2 人在环中确认卡 */}
          {pendingL2.map((p) => (
            <div key={p.toolCallId} data-testid="l2-confirm-card" className="mt-3 rounded-xl border border-warning/40 bg-warning/5 p-3">
              <div className="flex items-center gap-1.5 text-caption font-semibold text-warning">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                需要你批准 · L2 对外动作
              </div>
              <div className="mt-1 break-all font-mono text-caption text-muted-foreground">{p.actionId}</div>
              <p className="mt-1.5 text-xs leading-5 text-foreground">{p.explain}</p>
              <div className="mt-2.5 flex gap-2">
                <Button size="sm" data-testid="l2-approve" className="h-7 flex-1 gap-1 text-xs" onClick={() => resolveL2(p.toolCallId, true)}>
                  <ShieldCheck className="h-3.5 w-3.5" /> 批准执行
                </Button>
                <Button size="sm" variant="outline" data-testid="l2-reject" className="h-7 flex-1 text-xs" onClick={() => resolveL2(p.toolCallId, false)}>
                  取消
                </Button>
              </div>
            </div>
          ))}

          {chat.error && (
            <p className="mt-3 text-xs leading-relaxed text-destructive">
              {/AI_CONFIG/i.test(chat.error.message)
                ? `${chat.error.message} —— 路径:设置 → AI 配置,填入 API Key 后重试。`
                : chat.error.message || '网络异常,请稍后重试'}
            </p>
          )}
        </div>
      </div>

      {/* ── 输入区（液态玻璃）── sticky bottom 吸底，随页面滚动始终可见；
          液态玻璃让下方滚动内容透出，沉浸式 */}
      <div className="sticky bottom-0 z-20 shrink-0 px-4 pb-4 pt-3">
        <div className="glass-liquid mx-auto flex w-full max-w-3xl items-center gap-2 rounded-2xl px-3 py-2 focus-within:border-primary/40">
          <input
            aria-label="与 Agent 对话"
            placeholder={busy ? '生成中…' : '和 Agent 对话'}
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && input.trim() && !busy) send(input);
            }}
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          <Button
            aria-label={busy ? '生成中' : '发送'}
            size="icon"
            disabled={busy || !input.trim()}
            onClick={() => { if (input.trim() && !busy) send(input); }}
            className="h-9 w-9 shrink-0 rounded-xl"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
