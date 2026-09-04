/**
 * FlowMind RAK — Agent Event Bus（Redis 跨实例 pub/sub + 本地即时分发）
 *
 * 事件流：
 *   emit() → ① 本地监听器立即触发（同进程 SSE 零延迟）
 *          ② 发布到 Redis 频道（fm:agent:<id>:events + fm:agent:global:events）
 *            → 其他实例（web/worker/cron 三角色）的订阅连接收到后路由到其本地监听器
 *
 * 去重：消息携带 _source（实例 ID），订阅端忽略本实例回环消息，避免重复分发。
 */
import type { AgentEvent } from "@/lib/shared/types";
import { getRedis, getRedisSubscriber, keys } from "../db/redis";

type Listener = (event: AgentEvent) => void;

const INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

interface WireEvent {
  _source: string;
  agentId: string;
  event: AgentEvent;
}

class AgentEventBus {
  private agentListeners = new Map<string, Set<Listener>>();
  private globalListeners = new Set<Listener>();
  private _redisReady = false;

  constructor() {
    // 订阅全局频道（模式订阅：fm:agent:*:events），跨实例路由到本地监听器
    this.initRedisSubscription();
  }

  private initRedisSubscription(): void {
    try {
      const sub = getRedisSubscriber();
      const onMessage = (_ch: string, message: string) => {
        try {
          const wire = JSON.parse(message) as WireEvent;
          if (wire._source === INSTANCE_ID) return; // 忽略本实例回环
          this.dispatchLocal(wire.agentId, wire.event);
        } catch {
          /* 解析失败忽略 */
        }
      };
      sub.on("pmessage", (_pattern, channel, message) => {
        if (channel === keys.agentGlobalChannel()) onMessage(channel, message);
      });
      sub.psubscribe(keys.agentGlobalChannel()).catch((e) => console.warn("[event-bus] psubscribe:", e.message));
      sub.on("ready", () => {
        this._redisReady = true;
      });
      sub.on("error", (e) => {
        this._redisReady = false;
        console.warn("[event-bus] redis:", e.message);
      });
    } catch (e) {
      console.warn("[event-bus] initRedisSubscription:", (e as Error).message);
    }
  }

  subscribe(agentId: string, listener: Listener): () => void {
    if (!this.agentListeners.has(agentId)) {
      this.agentListeners.set(agentId, new Set());
    }
    this.agentListeners.get(agentId)!.add(listener);
    return () => {
      this.agentListeners.get(agentId)?.delete(listener);
    };
  }

  subscribeAll(listener: Listener): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  private dispatchLocal(agentId: string, event: AgentEvent): void {
    this.agentListeners.get(agentId)?.forEach((l) => l(event));
    this.globalListeners.forEach((l) => l(event));
  }

  emit(agentId: string, event: AgentEvent): void {
    // ① 本地立即分发
    this.dispatchLocal(agentId, event);
    // ② 跨实例 fan-out（fire-and-forget，Redis 抖动不阻塞热路径）
    const wire: WireEvent = { _source: INSTANCE_ID, agentId, event };
    const payload = JSON.stringify(wire);
    try {
      const pub = getRedis();
      pub.publish(keys.agentEventsChannel(agentId), payload).catch(() => {});
      pub.publish(keys.agentGlobalChannel(), payload).catch(() => {});
    } catch (e) {
      console.warn("[event-bus] publish:", (e as Error).message);
    }
  }

  get redisReady(): boolean {
    return this._redisReady;
  }
}

export const agentEventBus = new AgentEventBus();
