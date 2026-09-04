/**
 * FlowMind — MongoDB 连接单例（文档 / 审计 / 时序类数据）
 *
 * 端点经 lib/cluster 服务目录解析（env MONGODB_URL 逃生门 > mesh/cluster）。
 * 数据面：
 *   - flowmind.memory_history  记忆变更版本历史（create/update/delete 全量审计，不可变 append）
 *   - flowmind.evolution_runs  自进化管道运行审计（各阶段事件 + before/after 指标）
 *   - flowmind.memory_recall   记忆召回日志（agent 语义召回轨迹，供用量统计）
 */
import { MongoClient, type Db } from "mongodb";
import { mongoUrl } from "@/lib/cluster";

export const MONGO_DB = "flowmind";
export const COLLECTIONS = {
  memoryHistory: "memory_history",
  evolutionRuns: "evolution_runs",
  memoryRecall: "memory_recall",
  agentJournal: "agent_journal",
  taskJournal: "task_journal",
} as const;

let _client: MongoClient | null = null;
let _db: Db | null = null;
let _indexesReady: Promise<void> | null = null;

/** 建索引（幂等；首次连接后自动执行一次，失败仅告警不阻断）。 */
async function ensureIndexesOnce(): Promise<void> {
  if (!_indexesReady) {
    _indexesReady = ensureMongoIndexes().catch((e) => {
      console.warn("[mongo] ensureIndexes failed:", (e as Error).message);
      _indexesReady = null; // 允许下次重试
    });
  }
  await _indexesReady;
}

/** 获取 Mongo 客户端（懒初始化；硬依赖，连接失败抛错由上层处理）。 */
export function getMongoClient(): MongoClient {
  if (!_client) {
    _client = new MongoClient(mongoUrl(), {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    _client.on("open", () => console.log("[mongo] connected"));
  }
  return _client;
}

/** 获取业务库句柄（首次连接后自动建索引）。 */
export async function getMongoDb(): Promise<Db> {
  let init = false;
  if (!_db) {
    const client = getMongoClient();
    await client.connect();
    _db = client.db(MONGO_DB);
    init = true;
  }
  if (init) await ensureIndexesOnce();
  return _db;
}

export async function closeMongo(): Promise<void> {
  if (_client) {
    await _client.close().catch(() => {});
    _client = null;
    _db = null;
  }
}

/** 建立唯一索引（幂等）。 */
export async function ensureMongoIndexes(): Promise<void> {
  const db = await getMongoDb();
  await Promise.all([
    db.collection(COLLECTIONS.memoryHistory).createIndex({ memoryId: 1, at: -1 }),
    db.collection(COLLECTIONS.evolutionRuns).createIndex({ runId: 1 }, { unique: true }),
    db.collection(COLLECTIONS.evolutionRuns).createIndex({ agentId: 1, startedAt: -1 }),
    db.collection(COLLECTIONS.memoryRecall).createIndex({ memoryId: 1, at: -1 }),
    db.collection(COLLECTIONS.memoryRecall).createIndex({ agentId: 1, at: -1 }),
    // agent_journal：按 agent 查时间线 + 跨 agent 按时间分桶（活动面板）
    db.collection(COLLECTIONS.agentJournal).createIndex({ agentId: 1, createdAt: -1 }),
    db.collection(COLLECTIONS.agentJournal).createIndex({ createdAt: 1 }),
  ]);
}
