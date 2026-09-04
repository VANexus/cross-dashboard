import { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";
import { getMongoDb, COLLECTIONS } from "@/lib/server/db/mongo";
import { getAgentsShared } from "@/lib/server/repositories/agent.repository";
import type { AgentStatus, MoodState } from "@/lib/shared/types";

/**
 * Agent 真实活动数据：心跳面板专用。
 * - 状态 / 情绪 / uptime 来自 agents 表
 * - 活动强度 = agent_journal（已迁 Mongo）真实日志在最近 60min 的分桶计数（5min × 12）
 * - 心跳年龄 = lastHeartbeat 距今秒数
 * 零 mock：全部来自真实库。
 */
export const GET = withDb(async (_request: NextRequest) => {
  const agents = await getAgentsShared();
  const now = new Date();
  // journal.created_at 由运行时写入 ISO UTC（如 2026-09-03T20:06:18.064Z），按 ISO 格式比较
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString();

  const mdb = await getMongoDb();
  const journals = await mdb
    .collection(COLLECTIONS.agentJournal)
    .find({ createdAt: { $gte: cutoffIso } }, { projection: { agentId: 1, createdAt: 1, type: 1 } })
    .toArray();

  const nowMs = now.getTime();
  // 5min × 12 分桶
  const buckets: Record<string, number[]> = {};
  for (const j of journals) {
    const agentId = j.agentId as string;
    const t = new Date(j.createdAt as string).getTime();
    if (Number.isNaN(t)) continue;
    const idx = Math.max(0, Math.min(11, Math.floor((nowMs - t) / (5 * 60 * 1000))));
    (buckets[agentId] ??= Array(12).fill(0))[11 - idx] += 1;
  }
  const totalCount: Record<string, number> = {};
  for (const j of journals) totalCount[j.agentId as string] = (totalCount[j.agentId as string] ?? 0) + 1;

  const data = agents.map((a) => {
    const last = a.lastHeartbeat ? new Date(a.lastHeartbeat).getTime() : null;
    const ageSec = last ? Math.max(0, Math.round((nowMs - last) / 1000)) : null;
    const mood = a.config?.mood;
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      status: a.status as AgentStatus,
      mood: mood ? (mood.state as MoodState) : undefined,
      energy: mood?.energy,
      uptimeSec: Math.round(a.uptime ?? 0),
      heartbeatAgeSec: ageSec,
      journalCount1h: totalCount[a.id] ?? 0,
      activityBuckets: buckets[a.id] ?? Array(12).fill(0),
    };
  });

  return success({ agents: data, fetchedAt: now.toISOString() });
});
