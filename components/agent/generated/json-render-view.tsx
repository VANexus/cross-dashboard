// components/agent/generated/json-render-view.tsx
// 'use client'：从 UIMessage parts 里抽取 json-render spec（useJsonRenderMessage）并渲染 <Renderer>。
// 两个对话入口（agent-drawer / dashboard-chat）复用。
// 注意：text 文本 part 已由调用方各自的 MarkdownMessage 分支渲染，本组件只负责 spec（不重复渲染文本）。
import { useMemo } from 'react';
import { useJsonRenderMessage, Renderer, StateProvider, ActionProvider } from '@json-render/react';
import type { DataPart } from '@json-render/react';
import { registry } from '@/lib/agent/genui/registry';

interface JsonRenderMessageViewProps {
  parts: DataPart[];
  /** 流式中：spec 编译未定型时给 loading 骨架 */
  streaming?: boolean;
  /** 供 question 组件回传答案到对话流 */
  onInteract?: (answer: unknown) => void;
}

/**
 * 抽取 json-render spec 并渲染 <Renderer>（仅 spec；text 由调用方渲染）。
 * question 组件提交：经 ActionProvider 的 answerQuestion action 回传 onInteract。
 */
export function JsonRenderMessageView({ parts, streaming = false, onInteract }: JsonRenderMessageViewProps) {
  const { spec, hasSpec } = useJsonRenderMessage(parts);

  const actionHandlers = useMemo(
    () => ({
      runUiAction: async (params?: Record<string, unknown>) => {
        const id = params?.id as string | undefined;
        if (!id) return;
        const runner = (globalThis as unknown as { __genuiRunAction?: (id: string, params: Record<string, unknown>) => void }).__genuiRunAction;
        runner?.(id, (params?.params as Record<string, unknown>) ?? {});
      },
      answerQuestion: async (params?: Record<string, unknown>) => {
        void params;
        onInteract?.(params);
      },
    }),
    [onInteract],
  );

  if (!hasSpec || !spec) return null;

  return (
    <div className="mt-1 min-w-0">
      <StateProvider initialState={{}}>
        <ActionProvider handlers={actionHandlers}>
          <Renderer spec={spec} registry={registry} loading={streaming} />
        </ActionProvider>
      </StateProvider>
    </div>
  );
}
