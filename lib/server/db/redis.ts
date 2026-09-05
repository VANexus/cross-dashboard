/**
 * FlowMind — Redis 连接单例（缓存 / 租约锁 / 事件总线）
 *
 * P1 数据层：端点经 lib/cluster 服务目录解析（env REDIS_URL 逃生门 > mesh/cluster）。
 * 用途：
 *   - Agent 实时在场（presence）与心跳 TTL 缓存 → Agent 管理页实时状态
 *   - Agent 事件总线跨实例 pub/sub（web/worker/cron 三角色共享）
 *   - 自进化 / 长任务的分布式租约锁（防多副本重复执行）
 */
import Redis, { type RedisOptions } from "ioredis";
import { redisUrl } from "@/lib/cluster";

let _client: Redis | null = null;
let _sub: Redis | null = null;

function options(): RedisOptions {
  return {
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
    lazyConnect: false,
    // 基础设施硬依赖：不静默降级，重连失败即报错由上层处理
    retryStrategy(times: number) {
      if (times > 10) return null;
      return Math.min(times * 500, 5000);
    },
  };
}

/** 主连接（命令）。 */
export function getRedis(): Redis {
  if (!_client) {
    _client = new Redis(redisUrl(), options());
    _client.on("error", (e) => console.warn("[redis] error:", e.message));
    _client.on("ready", () => console.log("[redis] ready"));
  }
  return _client;
}

/** 订阅专用连接（ioredis 订阅必须独立连接）。 */
export function getRedisSubscriber(): Redis {
  if (!_sub) {
    _sub = new Redis(redisUrl(), options());
    _sub.on("error", (e) => console.warn("[redis:sub] error:", e.message));
  }
  return _sub;
}

// ── 命名空间 ─────────────────────────────────────────────────

const NS = "fm";

export const keys = {
  agentPresence: (id: string) => `${NS}:agent:${id}:presence`,
  agentEventsChannel: (id: string) => `${NS}:agent:${id}:events`,
  agentGlobalChannel: () => `${NS}:agent:global:events`,
  workflowEventsChannel: (topic: string) => `${NS}:wf:${topic}:events`,
  workflowPattern: () => `${NS}:wf:*:events`,
  workflowRunSnapshot: (runId: string) => `${NS}:wf:run:${runId}:snapshot`,
  cycleLock: (id: string) => `${NS}:cycle:${id}:lock`,
  evolutionLock: (id: string) => `${NS}:evo:${id}:lock`,
  evolutionState: (id: string) => `${NS}:evo:${id}:state`,
} as const;

// ── 分布式租约锁（SET NX PX；防多副本并发）─────────────────

/**
 * 获取分布式锁；成功返回释放函数，失败（已被持有/等待超时）返回 null。
 * @param retryMs 自旋等待总时长（0 = 不等待立即失败）
 */
export async function acquireLock(
  key: string,
  ttlMs = 30_000,
  retryMs = 0,
): Promise<(() => Promise<void>) | null> {
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const client = getRedis();
  const deadline = Date.now() + retryMs;
  for (;;) {
    const ok = await client.set(key, token, "PX", ttlMs, "NX");
    if (ok === "OK") {
      return async () => {
        // 仅当 token 匹配才释放（防误删他人锁）
        const val = await client.get(key);
        if (val === token) await client.del(key);
      };
    }
    if (Date.now() >= deadline) return null;
    await new Promise((r) => setTimeout(r, 120));
  }
}

/** 读取当前锁持有者 token（调试/状态展示）。 */
export async function peekLock(key: string): Promise<string | null> {
  return getRedis().get(key);
}
