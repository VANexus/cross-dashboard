"use client";

/**
 * genUI 全局 Provider：把 json-render 的 State/Action/Visibility 三个 context
 * 提升到应用根部（SSR 也覆盖）。
 *
 * 背景：@json-render/react 的 useJsonRenderMessage / 组件渲染内部会直接调用
 * useStateStore（StateContext），该 hook 在任何 Provider 之外执行即抛错。
 * 之前只在单条消息渲染器内包裹 Provider，SSR 预渲染阶段 hook 仍在 Provider 外触发。
 * 全局包一层后，所有页面 / 抽屉 / 对话流 / SSR 渲染天然都在 Provider 树下。
 */
import { ReactNode } from "react";
import { StateProvider, ActionProvider, VisibilityProvider } from "@json-render/react";

const EMPTY_HANDLERS = {};

export function GenUIProvider({ children }: { children: ReactNode }) {
  return (
    <StateProvider initialState={{}}>
      {/* VisibilityProvider 内部使用 useStateStore，必须包在 StateProvider 内层 */}
      <VisibilityProvider>
        {/* handlers 用空对象占位：具体 runUiAction/answerQuestion 由各对话上下文注册（JSONUIProvider/ActionProvider 内联覆写） */}
        <ActionProvider handlers={EMPTY_HANDLERS}>{children}</ActionProvider>
      </VisibilityProvider>
    </StateProvider>
  );
}