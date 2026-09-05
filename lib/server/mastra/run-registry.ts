/**
 * lib/mastra/run-registry.ts
 *
 * suspended Run 的跨实例快照（D2·多副本恢复）。
 *
 * mastra 的 Run 对象只能在进程内 resume（无序列化 API），多副本/重启后
 * 内存中的 suspended Run 会失联。这里把「suspend 点的业务上下文」落 Redis：
 *   - suspend 到达时由 /api/agent/run 路由写入快照（TTL 30min）；
 *   - resume 请求打到任意（或新的）pod 时，先用内存 activeRuns（热路径，
 *     mastra 原生 resume，事件照常走 watch）；
 *   - 内存没有 · Redis 有快照 → 冷恢复：由 workflow 侧导出的 continuation
 *     （复用同一批工具函数）直接执行 suspend 之后的步骤，事件手动派发；
 *   - 冷恢复完成后立即删除快照（GET+DEL 尽力原子，避免重复消费）。
 *
 * 快照只含「业务半成品」（如 Listing 草稿），不含 mastra 内部执行图。
 */
import { getRedis, keys } from "@/lib/server/db/redis";

/** 挂起运行的业务级快照。 */
export interface RunSnapshot {
  workflowId: string;
  runId: string;
  stepId: string;
  /** suspend 到达时的业务上下文（workflow step 的 output，含半成品）。 */
  context: Record<string, unknown>;
  /** suspend 步骤对外展示的信息（plan_step confirm 卡片用）。 */
  suspendPayload?: Record<string, unknown>;
  updatedAt: number;
}

export const RUN_SNAPSHOT_TTL_S = 30 * 60;

function keyOf(runId: string): string {
  return keys.workflowRunSnapshot(runId);
}

/** 写入/覆盖挂起快照（TTL 30min，超时未确认自动过期）。 */
export async function saveRunSnapshot(snapshot: RunSnapshot): Promise<void> {
  try {
    const pub = getRedis();
    await pub.set(keyOf(snapshot.runId), JSON.stringify(snapshot), "EX", RUN_SNAPSHOT_TTL_S);
  } catch {
    /* Redis 不可用：降级为仅内存（单实例仍可热恢复） */
  }
}

/** 读取快照（无/已过期返回 null）。 */
export async function getRunSnapshot(runId: string): Promise<RunSnapshot | null> {
  try {
    const pub = getRedis();
    const raw = await pub.get(keyOf(runId));
    if (!raw) return null;
    const snap = JSON.parse(raw) as RunSnapshot;
    return snap && snap.runId === runId ? snap : null;
  } catch {
    return null;
  }
}

/** 删除快照（冷恢复完成后调用；不抛错，尽力而为）。 */
export async function deleteRunSnapshot(runId: string): Promise<void> {
  try {
    const pub = getRedis();
    await pub.del(keyOf(runId));
  } catch {
    /* 忽略 */
  }
}