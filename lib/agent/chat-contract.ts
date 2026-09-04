// lib/agent/chat-contract.ts
// Agent 对话的前端共享契约：UI message 类型、client tool zod schema、L2 挂起、实时动作推导。
// 两个对话入口共用——AgentDrawer（三面一体面板：灵动岛/侧栏/舞台）与 DashboardChat
//（仪表盘对话核心）——保证它们指向同一份 /api/agent/chat 协议与持久化会话。
import type { UIDataTypes, UIMessage } from 'ai';
import { z } from 'zod';
import type { LiveActivity } from '@/stores/agent-presence';

/** 活跃会话 id 的 localStorage key（两对话入口共享同一会话） */
export const CONV_STORAGE_KEY = 'flowmind.activeConversationId';

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

export const uiActionInputSchema = z.object({
  id: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const renderComponentInputSchema = z.object({
  component: z.string().min(1),
  props: z.record(z.string(), z.unknown()).optional(),
});

/** L2 动作挂起项：模型已发起、等待用户在确认卡上当次批准/取消。 */
export interface PendingL2 {
  toolCallId: string;
  actionId: string;
  params: Record<string, unknown>;
  explain: string;
}

/**
 * 从最近一条助手消息推导主 Agent 当前动作（逆序遍历 parts，取第一个「进行中」的片段）。
 * 供对话入口顶部实时活动横幅 + 全局（灵动岛/聚焦气泡）展示——让用户一眼知道 Agent 在干嘛。
 */
export function deriveLiveActivity(messages: AgentUIMessage[], pendingL2: PendingL2[]): LiveActivity {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    const parts = (m.parts ?? []) as unknown[];
    for (let j = parts.length - 1; j >= 0; j--) {
      const p = parts[j] as {
        type?: string;
        state?: string;
        toolName?: string;
        toolCallId?: string;
        input?: { id?: string };
        text?: string;
      };
      if (!p || typeof p !== 'object') continue;
      const st = p.state;
      if (p.type === 'dynamic-tool') {
        if (st === 'input-streaming' || st === 'input-available') {
          return { kind: 'tool', text: `正在调用 ${p.toolName}…` };
        }
        if (st === 'output-error') {
          return { kind: 'error', text: `${p.toolName} 执行失败` };
        }
        continue; // output-available：已完成的工具步骤，继续向前找进行中的片段
      }
      if (p.type === 'tool-render_component') {
        if (st === 'input-streaming') return { kind: 'component', text: '正在生成图表组件…' };
        continue;
      }
      if (p.type === 'tool-ui_action') {
        if (st === 'input-streaming') {
          return { kind: 'action', text: `正在执行页面动作 ${p.input?.id ?? ''}…` };
        }
        if (st === 'input-available') {
          const isL2 = pendingL2.some((x) => x.toolCallId === p.toolCallId);
          return isL2
            ? { kind: 'l2', text: `等待你确认 · ${p.input?.id ?? '动作'}` }
            : { kind: 'action', text: `正在执行页面动作 ${p.input?.id ?? ''}…` };
        }
        continue;
      }
      if (p.type === 'text' && typeof p.text === 'string' && p.text.trim()) {
        // 最近一条助手消息的最后一个非空 text part → 正在组织回答
        return { kind: 'thinking', text: '正在回答…' };
      }
    }
  }
  return { kind: 'idle', text: '' };
}

/** DB 消息 → ai@7 UI message（text part + 可选 data-spec part）。会话恢复时两入口共用。 */
export function dbMessageToUI(m: { id: string; role: string; content: string; parts?: unknown }): AgentUIMessage {
  const parts: Array<{ type: 'text'; text: string } | { type: 'data-spec'; data: unknown }> = [];
  if (m.content) parts.push({ type: 'text', text: m.content });
  // 恢复 json-render data-spec parts（服务端落库时已存为 { type:'data', data }），组件能重现
  if (Array.isArray(m.parts)) {
    for (const p of m.parts as Array<{ type?: string; data?: unknown }>) {
      if (p && p.type === 'data' && p.data !== undefined) {
        parts.push({ type: 'data-spec', data: p.data });
      }
    }
  }
  return {
    id: m.id,
    role: (m.role === 'assistant' || m.role === 'user' ? m.role : 'user') as 'user' | 'assistant',
    parts,
  };
}

/** AI-Native 对话历史：会话摘要（对齐 /api/agent/conversations 响应）。 */
export interface ConversationSummary {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}
