/**
 * FlowMind — 全站数据联动事件总线
 *
 * 轻量 window CustomEvent 实现：任何客户端操作落库成功后 emit，
 * 订阅方（如仪表盘 shell）防抖触发 router.refresh()，实现
 * 「编排产物 → 任务/内容库 → 仪表盘卡片」环环相扣的实时联动。
 */

"use client";

import { useEffect, useRef } from "react";

export type DataScope = "tasks" | "content" | "agents" | "workflows" | "all";

const EVENT = "flowmind:data-changed";

interface DataChangedDetail {
  scope: DataScope;
  at: number;
}

/** 广播「数据已变化」；scope 用于订阅方按需过滤 */
export function emitDataChanged(scope: DataScope = "all") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<DataChangedDetail>(EVENT, { detail: { scope, at: Date.now() } }));
}

/**
 * 订阅数据变化事件。
 * - scopes 不传或为空 → 接收所有 scope
 * - scope="all" 的事件始终投递
 * - 防抖合并（默认 600ms），避免流式期间高频 refresh
 */
export function useDataChanged(
  handler: (scope: DataScope) => void,
  scopes?: DataScope[],
  debounceMs = 600,
) {
  const handlerRef = useRef(handler);
  // 渲染期不写 ref：在 effect 中同步最新 handler
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scopeKey = JSON.stringify(scopes ?? null);

  useEffect(() => {
    const allowed = scopeKey ? (JSON.parse(scopeKey) as DataScope[]) : null;

    const onEvent = (e: Event) => {
      const scope = (e as CustomEvent<DataChangedDetail>).detail?.scope ?? "all";
      if (allowed && allowed.length > 0 && scope !== "all" && !allowed.includes(scope)) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => handlerRef.current(scope), debounceMs);
    };

    window.addEventListener(EVENT, onEvent);
    return () => {
      window.removeEventListener(EVENT, onEvent);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scopeKey, debounceMs]);
}
