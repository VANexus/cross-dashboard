// lib/mastra/event-bus.ts
// 事件总线（进程内即时 + Redis 跨实例广播）：
// workflow 的 watch 事件由此广播到所有 /api/agent/stream SSE 连接。
// - 单机/单副本：本地 listeners 即时触发，零延迟；
// - 多副本/多角色（web/worker/cron）：其他 pod 产生的事件（如 worker 跑长任务、
//   cron 定时推送）经 Redis 频道跨实例路由到用户所连的 web pod —— 忽略本实例回环。
import type { AgentEvent } from '@/lib/agent/contracts';
import { getRedis, getRedisSubscriber, keys } from '../db/redis';

export const WORKFLOW_TOPIC = 'workflow';

type Listener = (event: AgentEvent) => void;

const INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

const topics = new Map<string, Set<Listener>>();

interface WireEvent {
  _source: string;
  topic: string;
  event: AgentEvent;
}

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

/** 向主题发布事件;监听器异常互不影响;Redis fan-out fire-and-forget。 */
export function publish(topic: string, event: AgentEvent): void {
  const set = topics.get(topic);
  if (set) {
    for (const listener of set) {
      try {
        listener(event);
      } catch {
        // 单个监听器(如已断开的 SSE 连接)失败不影响其他订阅者
      }
    }
  }
  // 跨实例 fan-out（Redis 抖动不阻塞热路径）
  try {
    const pub = getRedis();
    const wire: WireEvent = { _source: INSTANCE_ID, topic, event };
    pub.publish(keys.workflowEventsChannel(topic), JSON.stringify(wire)).catch(() => {});
  } catch {
    /* 无 Redis 时静默降级为纯本地总线 */
  }
}

// 跨实例订阅（模块加载即启动；Redis 不可用时静默降级为纯本地总线）
try {
  const sub = getRedisSubscriber();
  sub.on('pmessage', (_pattern, _channel, message) => {
    let wire: WireEvent;
    try {
      wire = JSON.parse(message) as WireEvent;
    } catch {
      return; // 坏帧忽略
    }
    if (wire._source === INSTANCE_ID) return; // 忽略本实例回环
    const set = topics.get(wire.topic);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(wire.event);
      } catch {
        /* 忽略单个监听器异常 */
      }
    }
  });
  sub.psubscribe(keys.workflowPattern()).catch((e) => console.warn('[event-bus] psubscribe workflow:', e.message));
  sub.on('error', (e) => console.warn('[event-bus] redis:', e.message));
} catch (e) {
  console.warn('[event-bus] init:', (e as Error).message);
}