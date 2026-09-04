/**
 * FlowMind — Milvus 记忆语义索引（dense + sparse(BM25) 混合检索）
 *
 * 集合 flowmind_memory：
 *   - dense  ：768 维稠密向量（来源 lib/server/db/embeddings.ts）
 *   - sparse ：BM25 内置全文函数自动计算（content 字段 chinese 分词器）
 * 检索：hybridSearch（dense 余弦 + sparse BM25 → RRF 融合）。
 *
 * 硬依赖：端点经 lib/cluster 解析；不可用即抛错（无降级）。
 */
import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import { milvusUrl } from "@/lib/cluster";
import { EMBEDDING_DIM, embedTexts } from "./embeddings";

export const MEMORY_COLLECTION = "flowmind_memory";

let _client: MilvusClient | null = null;

export function getMilvus(): MilvusClient {
  if (!_client) {
    _client = new MilvusClient({ address: milvusUrl() });
  }
  return _client;
}

export interface MemoryIndexDoc {
  id: string;
  title: string;
  content: string;
  type: string;
  zone: string;
  tags: string[];
  agentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 建集合 + 双索引 + 加载（幂等）。 */
export async function ensureMemoryCollection(): Promise<void> {
  const client = getMilvus();
  const exists = await client.hasCollection({ collection_name: MEMORY_COLLECTION });
  if (!exists.value) {
    const res = await client.createCollection({
      collection_name: MEMORY_COLLECTION,
      fields: [
        { name: "id", data_type: DataType.VarChar, is_primary_key: true, max_length: 128 },
        { name: "title", data_type: DataType.VarChar, max_length: 512 },
        { name: "content", data_type: DataType.VarChar, max_length: 65535, enable_analyzer: true, analyzer_params: { type: "chinese" } },
        { name: "type", data_type: DataType.VarChar, max_length: 64 },
        { name: "zone", data_type: DataType.VarChar, max_length: 64 },
        { name: "tags", data_type: DataType.VarChar, max_length: 4096 },
        { name: "agent_id", data_type: DataType.VarChar, max_length: 128 },
        { name: "created_at", data_type: DataType.VarChar, max_length: 64 },
        { name: "updated_at", data_type: DataType.VarChar, max_length: 64 },
        { name: "dense", data_type: DataType.FloatVector, dim: EMBEDDING_DIM },
        { name: "sparse", data_type: DataType.SparseFloatVector },
      ],
      functions: [
        { name: "bm25_fn", type: "BM25", input_field_names: ["content"], output_field_names: ["sparse"], params: {} },
      ],
    });
    if (res.error_code !== "Success") {
      throw new Error(`[milvus] createCollection: ${res.reason ?? "failed"}`);
    }
  }

  // 双索引（幂等）
  const idxRes = await client.describeIndex({ collection_name: MEMORY_COLLECTION });
  const indexed = new Set((idxRes.index_descriptions ?? []).map((i) => i.field_name));
  if (!indexed.has("dense")) {
    await client.createIndex({
      collection_name: MEMORY_COLLECTION,
      field_name: "dense",
      index_type: "IVF_FLAT",
      metric_type: "IP",
      params: { nlist: 128 },
    });
  }
  if (!indexed.has("sparse")) {
    await client.createIndex({
      collection_name: MEMORY_COLLECTION,
      field_name: "sparse",
      index_type: "SPARSE_INVERTED_INDEX",
      metric_type: "BM25",
      params: {},
    });
  }

  const loadRes = await client.loadCollection({ collection_name: MEMORY_COLLECTION });
  if (loadRes.error_code && loadRes.error_code !== "Success") {
    throw new Error(`[milvus] loadCollection: ${loadRes.reason ?? "failed"}`);
  }
}

/** 写入/更新单条记忆（dense 由 embedTexts 计算，sparse 由服务端 BM25 自动生成）。 */
export async function indexMemory(doc: MemoryIndexDoc): Promise<void> {
  await ensureMemoryCollection();
  const [dense] = await embedTexts([`${doc.title} ${doc.content}`]);
  const res = await getMilvus().upsert({
    collection_name: MEMORY_COLLECTION,
    data: [
      {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        type: doc.type,
        zone: doc.zone,
        tags: JSON.stringify(doc.tags ?? []),
        agent_id: doc.agentId ?? "",
        created_at: doc.createdAt,
        updated_at: doc.updatedAt,
        dense,
      },
    ],
  });
  if (res.status?.error_code && res.status.error_code !== "Success") {
    throw new Error(`[milvus] upsert: ${res.status.reason ?? "failed"}`);
  }
}

/** 删除单条记忆向量。 */
export async function unindexMemory(id: string): Promise<void> {
  await ensureMemoryCollection();
  const res = await getMilvus().delete({ collection_name: MEMORY_COLLECTION, filter: `id == "${id}"` });
  if (res.status?.error_code && res.status.error_code !== "Success") {
    throw new Error(`[milvus] delete: ${res.status.reason ?? "failed"}`);
  }
}

export interface MemorySearchHit {
  id: string;
  score: number;
}

export interface MemorySearchOptions {
  limit?: number;
  /** 过滤表达式（Milvus expr），如 `agent_id == "sentinel-001"` */
  filter?: string;
}

/**
 * 混合语义检索：dense（查询语义） + sparse（BM25 精确词匹配）→ RRF 融合。
 * 零降级：始终走 Milvus。
 */
export async function searchMemories(query: string, opts: MemorySearchOptions = {}): Promise<MemorySearchHit[]> {
  const limit = opts.limit ?? 10;
  await ensureMemoryCollection();
  const [dense] = await embedTexts([query]);

  const res = await getMilvus().hybridSearch({
    collection_name: MEMORY_COLLECTION,
    data: [
      { data: [dense], anns_field: "dense", limit, params: {} },
      { data: [query], anns_field: "sparse", limit, params: {} },
    ],
    rerank: { strategy: "rrf", params: {} },
    limit,
    output_fields: ["id"],
    ...(opts.filter ? { filter: opts.filter } : {}),
  } as never);

  if (res.status?.error_code && res.status.error_code !== "Success") {
    throw new Error(`[milvus] search: ${res.status.reason ?? "failed"}`);
  }
  const results = (res.results ?? []) as Array<{ id: string; score: number }>;
  return results.map((r) => ({ id: r.id, score: r.score }));
}

/**
 * 从 PG 全量重建索引：清空集合 → 逐条向量化写入。
 * @param onProgress 进度回调（已处理数 / 总数）
 */
export async function rebuildMemoryIndex(
  fetchAll: () => Promise<MemoryIndexDoc[]>,
  onProgress?: (done: number, total: number) => void,
): Promise<{ total: number }> {
  await ensureMemoryCollection();
  // 清空
  const del = await getMilvus().delete({ collection_name: MEMORY_COLLECTION, filter: 'id != ""' });
  if (del.status?.error_code && del.status.error_code !== "Success") {
    throw new Error(`[milvus] rebuild clear: ${del.status.reason ?? "failed"}`);
  }
  const docs = await fetchAll();
  if (docs.length === 0) return { total: 0 };

  // 批量向量化 + 批量 upsert
  const vectors = await embedTexts(docs.map((d) => `${d.title} ${d.content}`));
  const client = getMilvus();
  const BATCH = 64;
  for (let i = 0; i < docs.length; i += BATCH) {
    const chunk = docs.slice(i, i + BATCH);
    const rows = chunk.map((d, j) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      type: d.type,
      zone: d.zone,
      tags: JSON.stringify(d.tags ?? []),
      agent_id: d.agentId ?? "",
      created_at: d.createdAt,
      updated_at: d.updatedAt,
      dense: vectors[i + j],
    }));
    const res = await client.upsert({ collection_name: MEMORY_COLLECTION, data: rows });
    if (res.status?.error_code && res.status.error_code !== "Success") {
      throw new Error(`[milvus] rebuild upsert: ${res.status.reason ?? "failed"}`);
    }
    onProgress?.(Math.min(i + BATCH, docs.length), docs.length);
  }
  return { total: docs.length };
}

/** 集合统计（面板展示）。 */
export async function memoryCollectionStats(): Promise<{ count: number; exists: boolean }> {
  try {
    const client = getMilvus();
    const exists = await client.hasCollection({ collection_name: MEMORY_COLLECTION });
    if (!exists.value) return { count: 0, exists: false };
    const stats = await client.getCollectionStatistics({ collection_name: MEMORY_COLLECTION });
    return { count: Number(stats.stats?.[0]?.value ?? 0), exists: true };
  } catch (e) {
    throw new Error(`[milvus] stats: ${(e as Error).message}`);
  }
}
