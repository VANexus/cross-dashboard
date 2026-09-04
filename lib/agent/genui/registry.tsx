// lib/agent/genui/registry.tsx
// 'use client'：把 catalog 的组件/action 绑定到真实 React 实现。
// - components：直接复用 component-kit 的 def.render(props)（图表继续走 next/dynamic 拆包，
//   html/html-app 照旧；json-render 原生 children/slots/repeat 吸收 compose 的职责）。
// - actions：runUiAction 走与 ui_action client tool 相同的 getActionById + 风险分级 + L2 挂起；
//   answerQuestion 把回答作为下一条用户消息回传给对话流（经注入的 onInteract）。
import type { ReactNode } from 'react';
import { defineRegistry } from '@json-render/react';
import { catalog, type GenUICatalog } from './catalog';
import { componentDefs } from '@/components/agent/generated';

/** 从 catalog 的组件 key 查 component-kit def，复用其 render。 */
function renderByDef(id: string, props: Record<string, unknown>): ReactNode {
  const def = componentDefs.find((d) => d.id === id);
  if (!def) return <p className="text-xs text-destructive">未注册组件：{id}</p>;
  return def.render(props ?? {});
}

// ── 组件注册表（组件 key → 渲染函数） ───────────────────────────────
export const { registry, handlers: _handlers } = defineRegistry(catalog, {
  components: {
    'stat-card': ({ props }) => renderByDef('stat-card', props as Record<string, unknown>),
    'data-table': ({ props }) => renderByDef('data-table', props as Record<string, unknown>),
    'ranking': ({ props }) => renderByDef('ranking', props as Record<string, unknown>),
    'compare': ({ props }) => renderByDef('compare', props as Record<string, unknown>),
    'metric-grid': ({ props }) => renderByDef('metric-grid', props as Record<string, unknown>),
    'callout': ({ props }) => renderByDef('callout', props as Record<string, unknown>),
    'tag-list': ({ props }) => renderByDef('tag-list', props as Record<string, unknown>),
    'progress': ({ props }) => renderByDef('progress', props as Record<string, unknown>),
    'timeline': ({ props }) => renderByDef('timeline', props as Record<string, unknown>),
    'question': ({ props, emit }) => {
      // question 组件的「提交」走 answerQuestion action（emit('answerQuestion', {answer})）
      const { onInteract } = props as { onInteract?: (a: unknown) => void };
      return (
        <div data-genui-question>
          {renderByDef('question', {
            ...(props as Record<string, unknown>),
            onInteract: (answer: unknown) => {
              onInteract?.(answer);
              emit('answerQuestion');
            },
          })}
        </div>
      );
    },
  },
  actions: {
    runUiAction: async (params) => {
      const p = params as { id?: string; params?: Record<string, unknown> } | undefined;
      const id = p?.id;
      if (!id) return;
      // 走注入的全局 action 执行器（agent-drawer/dashboard-chat 挂到 window，避免循环依赖）
      const runner = (globalThis as unknown as { __genuiRunAction?: (id: string, params: Record<string, unknown>) => void }).__genuiRunAction;
      if (runner) runner(id, p?.params ?? {});
    },
    answerQuestion: async () => {
      // answer 经 question 组件 onInteract 已回传；此处仅确认 action 命中
    },
  },
});

/** 供 AgentDrawer / DashboardChat 挂载全局 action 执行器（避免模块循环依赖）。 */
export function installGenUIActionRunner(runner: (id: string, params: Record<string, unknown>) => void): void {
  (globalThis as unknown as { __genuiRunAction?: (id: string, params: Record<string, unknown>) => void }).__genuiRunAction = runner;
}

export type { GenUICatalog };
