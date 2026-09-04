/**
 * B端运营 — 语义知识库（Milvus b2b 分区分集）
 *
 * 复用 lib/server/db/milvus.ts / embeddings.ts 的基建，为 B 端运营场景新增独立集合
 * flowmind_b2b_kb，按 zone 分三类实体：
 *   - product : 商品池（recommend 前按趋势词 RAG 检索 top-N，替代全量塞 prompt）
 *   - skill   : 生图 Skill 库（progressive disclosure：元数据在上下文，正文按检索装载）
 *   - trend   : 关卡热词/长尾词（每日摘要归因检索素材）
 *
 * 与通用 Agent 记忆（flowmind_memory）隔离，避免互相污染检索结果。
 * 硬依赖：Milvus 经 lib/cluster 解析，不可用即抛错（无 mock、无降级到全量扫描的前提是
 * 数据量小——调用方应对检索失败降级为全量枚举，本层不吞错）。
 */
import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import { milvusUrl } from "@/lib/cluster";
import { EMBEDDING_DIM, embedTexts } from "./embeddings";

export const B2B_KB_COLLECTION = "flowmind_b2b_kb";

export type B2BKbZone = "product" | "skill" | "trend";

let _client: MilvusClient | null = null;
function getClient(): MilvusClient {
  if (!_client) _client = new MilvusClient({ address: milvusUrl() });
  return _client;
}

export interface B2BKbDoc {
  id: string;
  zone: B2BKbZone;
  title: string;
  content: string;
  tags?: string[];
  meta?: Record<string, string>;
}

/** 建集合并就绪（幂等）：dense 向量 + BM25 全文双索引。 */
export async function ensureB2BKbCollection(): Promise<void> {
  const client = getClient();
  const exists = await client.hasCollection({ collection_name: B2B_KB_COLLECTION });
  if (!exists.value) {
    const res = await client.createCollection({
      collection_name: B2B_KB_COLLECTION,
      fields: [
        { name: "id", data_type: DataType.VarChar, is_primary_key: true, max_length: 128 },
        { name: "zone", data_type: DataType.VarChar, max_length: 32 },
        { name: "title", data_type: DataType.VarChar, max_length: 512 },
        { name: "content", data_type: DataType.VarChar, max_length: 20000, enable_analyzer: true, analyzer_params: { type: "chinese" } },
        { name: "tags", data_type: DataType.VarChar, max_length: 4096 },
        { name: "meta", data_type: DataType.VarChar, max_length: 8192 },
        { name: "dense", data_type: DataType.FloatVector, dim: EMBEDDING_DIM },
        { name: "sparse", data_type: DataType.SparseFloatVector },
      ],
      functions: [
        { name: "bm25_fn", type: "BM25", input_field_names: ["content"], output_field_names: ["sparse"], params: {} },
      ],
    });
    if (res.error_code !== "Success") throw new Error(`[b2b-kb] createCollection: ${res.reason ?? "failed"}`);
  }
  const idxRes = await client.describeIndex({ collection_name: B2B_KB_COLLECTION });
  const indexed = new Set((idxRes.index_descriptions ?? []).map((i) => i.field_name));
  if (!indexed.has("dense")) {
    await client.createIndex({ collection_name: B2B_KB_COLLECTION, field_name: "dense", index_type: "IVF_FLAT", metric_type: "IP", params: { nlist: 128 } });
  }
  if (!indexed.has("sparse")) {
    await client.createIndex({ collection_name: B2B_KB_COLLECTION, field_name: "sparse", index_type: "SPARSE_INVERTED_INDEX", metric_type: "BM25", params: {} });
  }
  await client.loadCollection({ collection_name: B2B_KB_COLLECTION });
}

/** 写入/更新一条 KB 文档。 */
export async function upsertB2BKb(doc: B2BKbDoc): Promise<void> {
  await ensureB2BKbCollection();
  const [dense] = await embedTexts([`${doc.title} ${doc.content}`]);
  await getClient().upsert({
    collection_name: B2B_KB_COLLECTION,
    data: [{
      id: doc.id,
      zone: doc.zone,
      title: doc.title,
      content: doc.content,
      tags: JSON.stringify(doc.tags ?? []),
      meta: JSON.stringify(doc.meta ?? {}),
      dense,
    }],
  });
}

/** 批量写入（建库/重建用）。 */
export async function bulkUpsertB2BKb(docs: B2BKbDoc[]): Promise<void> {
  if (docs.length === 0) return;
  await ensureB2BKbCollection();
  const vectors = await embedTexts(docs.map((d) => `${d.title} ${d.content}`));
  const rows = docs.map((d, i) => ({
    id: d.id,
    zone: d.zone,
    title: d.title,
    content: d.content,
    tags: JSON.stringify(d.tags ?? []),
    meta: JSON.stringify(d.meta ?? {}),
    dense: vectors[i],
  }));
  const BATCH = 64;
  const client = getClient();
  for (let i = 0; i < rows.length; i += BATCH) {
    const res = await client.upsert({ collection_name: B2B_KB_COLLECTION, data: rows.slice(i, i + BATCH) });
    if (res.status?.error_code && res.status.error_code !== "Success") {
      throw new Error(`[b2b-kb] upsert: ${res.status.reason ?? "failed"}`);
    }
  }
}

/** 删除单条；或指定 Milvus 过滤表达式（如 `id like "p-%"`）批量删除。 */
export async function deleteB2BKb(idOrFilter: string): Promise<void> {
  await ensureB2BKbCollection();
  const filter = /[=<>]/.test(idOrFilter) ? idOrFilter : `id == "${idOrFilter}"`;
  await getClient().delete({ collection_name: B2B_KB_COLLECTION, filter });
}

export interface B2BKbSearchHit {
  id: string;
  zone: B2BKbZone;
  title: string;
  content: string;
  tags: string[];
  meta: Record<string, string>;
  score: number;
}

/** 语义混合检索（dense + BM25 → RRF），可选按 zone 过滤。 */
export async function searchB2BKb(
  query: string,
  opts: { zone?: B2BKbZone; limit?: number; outputContent?: boolean } = {},
): Promise<B2BKbSearchHit[]> {
  const limit = opts.limit ?? 10;
  await ensureB2BKbCollection();
  const [dense] = await embedTexts([query]);
  const res = await getClient().hybridSearch({
    collection_name: B2B_KB_COLLECTION,
    data: [
      { data: [dense], anns_field: "dense", limit, params: {} },
      { data: [query], anns_field: "sparse", limit, params: {} },
    ],
    rerank: { strategy: "rrf", params: {} },
    limit,
    output_fields: ["id", "zone", "title", "content", "tags", "meta"],
    ...(opts.zone ? { filter: `zone == "${opts.zone}"` } : {}),
  } as never);

  if (res.status?.error_code && res.status.error_code !== "Success") {
    throw new Error(`[b2b-kb] search: ${res.status.reason ?? "failed"}`);
  }
  const results = (res.results ?? []) as Array<{
    id: string; zone: string; title?: string; content?: string; tags?: string; meta?: string; score: number;
  }>;
  return results.map((r) => {
    let tags: string[] = [];
    let meta: Record<string, string> = {};
    try { tags = JSON.parse(r.tags ?? "[]"); } catch { /* 忽略坏 tags */ }
    try { meta = JSON.parse(r.meta ?? "{}"); } catch { /* 忽略坏 meta */ }
    return {
      id: r.id,
      zone: r.zone as B2BKbZone,
      title: r.title ?? "",
      content: opts.outputContent ? (r.content ?? "") : "",
      tags,
      meta,
      score: r.score,
    };
  });
}

/** 集合统计（面板展示）。 */
export async function b2bKbStats(): Promise<{ count: number; exists: boolean }> {
  try {
    const client = getClient();
    const exists = await client.hasCollection({ collection_name: B2B_KB_COLLECTION });
    if (!exists.value) return { count: 0, exists: false };
    const stats = await client.getCollectionStatistics({ collection_name: B2B_KB_COLLECTION });
    return { count: Number(stats.stats?.[0]?.value ?? 0), exists: true };
  } catch (e) {
    throw new Error(`[b2b-kb] stats: ${(e as Error).message}`);
  }
}