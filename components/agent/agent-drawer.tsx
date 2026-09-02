// components/agent/agent-drawer.tsx
'use client';
// 右侧 Agent 抽屉：唯一的对话面。
// ai@7 useChat（transport → /api/agent/chat，请求体带动态 pageContext）：
// token 级流式文本 + ui_action client tool 本地执行（按 id 路由 → zod 校验 → execute → addToolResult 回传统推）。
// 打开时 framer-motion 把主内容(#app-main 父列)真实挤压缩排；问答锚定 presence.context；球状态经 setLiveState 联动。
// 视觉遵循 FlowMind 设计 token（globals.css），骨架件复用 components/ui，动画统一 framer-motion。
import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2, Radar, SendHorizontal, X } from 'lucide-react';
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
          helpersRef.current?.addToolResult({
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
        helpersRef.current?.addToolResult({
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
      pushTelemetry('Agent', `执行 UI 动作 · ${action.id}`);
      Promise.resolve()
        .then(() => action.execute(params))
        .then((summary) => {
          helpersRef.current?.addToolResult({
            tool: 'ui_action',
            toolCallId: toolCall.toolCallId,
            output: summary,
          });
          pushTelemetry('Agent', summary.slice(0, 24));
        })
        .catch((err) =>
          fail(`动作 ${action.id} 执行失败：${err instanceof Error ? err.message : String(err)}`),
        );
    },
    onError: () => setLiveState('idle', 0.12),
    onFinish: ({ isError }) => {
      setLiveState('idle', 0.12);
      pushTelemetry('选品 Agent', isError ? '回答中断' : '就地回答完成 ✓');
    },
  });
  // useChat 官方模式:每次渲染后经 effect 刷新 ref,保证 onToolCall 闭包取到最新 helpers
  useEffect(() => {
    helpersRef.current = chat;
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
          <div className="text-[13px] font-bold leading-tight text-foreground">Agent 视域</div>
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground">
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
          <div className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 font-mono text-[10.5px] text-primary">
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
              <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
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
                        'mt-1 max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed',
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
                  return (
                    <div key={part.toolCallId} className="mt-1.5">
                      {part.state === 'input-streaming' && (
                        <Badge variant="secondary" className="gap-1 font-normal">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          解析 UI 动作…
                        </Badge>
                      )}
                      {part.state === 'input-available' && (
                        <Badge variant="secondary" className="gap-1 font-normal">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          执行 {part.input?.id ?? '动作'}…
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

          {chat.error && (
            <p className="mt-2 text-[12.5px] leading-relaxed text-destructive">
              {/AI_CONFIG/i.test(chat.error.message)
                ? `${chat.error.message} —— 路径:设置 → AI 配置,填入 API Key 后重试。`
                : chat.error.message || '网络异常,请稍后重试'}
            </p>
          )}

          {/* 遥测 */}
          <div className="mt-4 pb-2">
            <div className="text-[11px] text-muted-foreground">Agent 遥测(实时)</div>
            <ul aria-live="polite" className="mt-1.5">
              {telemetry.length === 0 && (
                <li className="py-1.5 text-[11.5px] text-muted-foreground">等待事件…</li>
              )}
              {telemetry.map((t, idx) => (
                <li key={t.id}>
                  <div className="flex items-center gap-2 py-1.5 text-[11.5px]">
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
          className="h-9 flex-1 text-[12.5px]"
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
