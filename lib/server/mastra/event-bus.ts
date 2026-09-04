// lib/mastra/event-bus.ts
// 进程内事件总线:workflow 的 watch 事件经此广播到所有 /api/agent/stream SSE 连接。
// Next.js 单进程内运行(run route 发、stream route 收),无需跨进程。
import type { AgentEvent } from '@/lib/agent/contracts';

export const WORKFLOW_TOPIC = 'workflow';

type Listener = (event: AgentEvent) => void;

const topics = new Map<string, Set<Listener>>();

/** 订阅主题,返回退订函数。 */
export function subscribe(topic: string, listener: Listener): () => void {
  let set = topics.get(topic);
  if (!set) {
    set = new Set();
    topics.set(topic, set);
  }
  set.add(listener);
  return () => unsubscribe(topic, listener);
}

export function unsubscribe(topic: string, listener: Listener): void {
  const set = topics.get(topic);
  if (!set) return;
  set.delete(listener);
  if (set.size === 0) topics.delete(topic);
}

/** 向主题发布事件;监听器异常互不影响。 */
export function publish(topic: string, event: AgentEvent): void {
  const set = topics.get(topic);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(event);
    } catch {
      // 单个监听器(如已断开的 SSE 连接)失败不影响其他订阅者
    }
  }
}
