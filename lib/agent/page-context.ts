// lib/agent/page-context.ts
// 「页面即上下文」协议：每个页面经 useAgentPage() 一行接入——挂载时注册本页动作并
// 把 route/title/snapshot()/state()/actions 写入 presence store；卸载/路由变化自动清理。
// 快照/状态是函数：注册原样存，chat 请求组装时（serializePageContext）才求值并截断。
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { usePresence } from '@/stores/agent-presence';
import { getPageActions, registerPageActions, unregisterPageActions } from './ui-actions';
import type { UIActionDef } from './ui-actions';

/** 页面 Agent 上下文协议（snapshot/state 函数化，注册时原样存、使用时求值） */
export interface PageAgentContext {
  route: string;                          // 当前路由
  title: string;                          // 页面人设名（如「任务中心」）
  snapshot: () => string;                 // 数据摘要（同步，≤2KB 注入 chat）
  actions: UIActionDef[];                 // 本页可被 agent 调用的动作
  state?: () => Record<string, unknown>;  // 页面 UI 状态（筛选/选中行等，≤1KB JSON）
}

/** chat 请求携带的页面上下文（已求值 + 截断） */
export interface ChatPageContext {
  route: string;
  title: string;
  snapshot: string;
  state?: Record<string, unknown>;
  actions: { id: string; description: string }[];
}

const SNAPSHOT_MAX = 2 * 1024;   // snapshot ≤2KB
const STATE_MAX = 1 * 1024;      // state JSON ≤1KB

/** 从 presence store 取当前 pageContext，求值快照/状态并截断；无页面上下文时返回 null。 */
export function serializePageContext(): ChatPageContext | null {
  const pc = usePresence.getState().pageContext;
  if (!pc) return null;

  let snapshot = '';
  try {
    snapshot = pc.snapshot?.() ?? '';
  } catch {
    snapshot = '（快照求值失败）';
  }
  if (snapshot.length > SNAPSHOT_MAX) snapshot = snapshot.slice(0, SNAPSHOT_MAX) + '…[已截断]';

  // 追加页面可操作把手（data-agent-action 稳定选择器）——click/fill 动作的落点，agent 无需猜
  if (typeof document !== 'undefined') {
    const handles = Array.from(document.querySelectorAll('[data-agent-action]'))
      .map((el) => el.getAttribute('data-agent-action'))
      .filter((h): h is string => Boolean(h));
    if (handles.length > 0) {
      snapshot += `\n可操作把手（click 动作选择器）：${handles.map((h) => `[data-agent-action="${h}"]`).join(' ')}`;
    }
  }

  let state: Record<string, unknown> | undefined;
  if (pc.state) {
    try {
      const entries = Object.entries(pc.state() ?? {});
      const kept: Record<string, unknown> = {};
      let dropped = 0;
      for (const [k, v] of entries) {
        kept[k] = v;
        if (JSON.stringify(kept).length > STATE_MAX) {
          delete kept[k];
          dropped++;
        }
      }
      if (dropped > 0) kept.__truncated = `另 ${dropped} 项超限省略`;
      state = Object.keys(kept).length > 0 ? kept : undefined;
    } catch {
      state = undefined;
    }
  }

  return {
    route: pc.route,
    title: pc.title,
    snapshot,
    state,
    // 通用动作（navigate/refresh 等，抽屉全局注册）+ 本页动作合并上报，
    // 否则 system prompt 只列页面动作，模型会拒绝调用 navigate 这类全局能力。
    actions: getPageActions().map(({ id, description }) => ({ id, description })),
  };
}

export interface UseAgentPageOptions {
  /** 缺省用 usePathname() */
  route?: string;
  title: string;
  snapshot?: () => string;
  actions?: UIActionDef[];
  state?: () => Record<string, unknown>;
}

/**
 * 页面一行接入「前端即 Agent」：
 *   useAgentPage({ title: '任务中心', snapshot, state, actions });
 * 挂载时注册动作 + 写入 presence.pageContext；卸载/路由变化（usePathname 依赖）清理。
 * 快照/状态/动作经 ref 求最新闭包——注册后组件重渲染不会产生陈旧数据。
 */
export function useAgentPage(cfg: UseAgentPageOptions): void {
  const pathname = usePathname();
  const route = cfg.route ?? pathname ?? '/';
  const title = cfg.title;

  // effect 内刷新引用（不在渲染期写 ref），注册的包装函数使用时才解引用 → 永远执行最新闭包
  const latest = useRef(cfg);
  useEffect(() => {
    latest.current = cfg;
  });

  useEffect(() => {
    // 页面动作注册代理：execute 时解析最新动作定义，页面热更新/重渲染不失效
    const registered: UIActionDef[] = (latest.current.actions ?? []).map((a) => ({
      id: a.id,
      description: a.description,
      schema: a.schema,
      execute: (params: Record<string, unknown>) => {
        const live = latest.current.actions?.find((x) => x.id === a.id);
        if (!live) return `动作 ${a.id} 已随页面更新失效`;
        return live.execute(params);
      },
    }));

    registerPageActions(registered);
    usePresence.getState().setPageContext({
      route,
      title,
      snapshot: () => latest.current.snapshot?.() ?? '',
      state: latest.current.state ? () => latest.current.state?.() ?? {} : undefined,
      actions: registered,
    });
    // 抽屉「当前上下文」锚随页面切换（进入页面即更新）
    usePresence.getState().setContext({ page: title });

    return () => {
      unregisterPageActions();
      usePresence.getState().clearPageContext();
    };
    // 路由变化（usePathname → route）或标题变化时重注册；snapshot/state/actions 走 ref
  }, [route, title]);
}
