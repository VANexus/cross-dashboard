/**
 * FlowMind RAK — Memory Service（端到端记忆系统）
 *
 * 三库协作（全真实写入，无降级）：
 *   - PG        ：关系事实源（memory_entries 列表/筛选/元数据）
 *   - Milvus    ：语义索引（dense + BM25 混合检索），写入即索引、检索走向量
 *   - MongoDB   ：版本历史 / 召回日志（不可变审计）
 */
import * as repo from "../repositories/memory.repository";
import {
  indexMemory,
  unindexMemory,
  searchMemories,
  rebuildMemoryIndex,
  memoryCollectionStats,
  type MemoryIndexDoc,
} from "../db/milvus";
import {
  appendMemoryHistory,
  getMemoryHistory,
  recordMemoryRecall,
} from "../db/mongo-stores";
import type { MemoryEntry, MemoryUsageStats, Pagination } from "@/lib/shared/types";

function toIndexDoc(e: MemoryEntry): MemoryIndexDoc {
  return {
    id: e.id,
    title: e.title,
    content: e.content,
    type: e.type,
    zone: e.zone,
    tags: e.tags ?? [],
    agentId: e.agentId ?? null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

export class MemoryService {
  async list(filters?: {
    zone?: string;
    type?: string;
    search?: string;
    agentId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: MemoryEntry[]; pagination: Pagination }> {
    return await repo.getMemoryEntries(filters);
  }

  async getById(id: string): Promise<MemoryEntry | null> {
    return await repo.getMemoryById(id);
  }

  async create(data: {
    zone: string;
    title: string;
    content: string;
    type: string;
    tags?: string[];
    agentId?: string;
  }): Promise<MemoryEntry> {
    const entry = await repo.createMemory(data);
    // 1) 同步 Milvus 语义索引
    await indexMemory(toIndexDoc(entry));
    // 2) 追加 Mongo 版本历史
    await appendMemoryHistory({
      memoryId: entry.id,
      action: "create",
      before: null,
      after: { title: entry.title, content: entry.content, type: entry.type, zone: entry.zone, tags: entry.tags },
      version: entry.version,
    });
    return entry;
  }

  async update(id: string, data: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
    const before = await repo.getMemoryById(id);
    const entry = await repo.updateMemory(id, data);
    if (!entry) return null;
    // 1) 同步 Milvus（内容变化 → 重算向量）
    await indexMemory(toIndexDoc(entry));
    // 2) 追加 Mongo 版本历史
    await appendMemoryHistory({
      memoryId: entry.id,
      action: "update",
      before: before
        ? { title: before.title, content: before.content, type: before.type, tags: before.tags, verified: before.verified }
        : null,
      after: { title: entry.title, content: entry.content, type: entry.type, tags: entry.tags, verified: entry.verified },
      version: entry.version,
    });
    return entry;
  }

  async delete(id: string): Promise<boolean> {
    const before = await repo.getMemoryById(id);
    const ok = await repo.deleteMemory(id);
    if (ok) {
      // 1) 移除 Milvus 向量
      await unindexMemory(id);
      // 2) 追加 Mongo 历史
      await appendMemoryHistory({
        memoryId: id,
        action: "delete",
        before: before ? { title: before.title, content: before.content, type: before.type } : null,
        after: null,
        version: before?.version ?? 1,
      });
    }
    return ok;
  }

  async getUsage(id: string): Promise<MemoryUsageStats | null> {
    return await repo.getMemoryUsage(id);
  }

  /**
   * 语义检索（Milvus 混合检索）：返回按相关性排序的记忆（附 score）。
   * 召回轨迹写入 Mongo（memory_recall），供用量统计。
   */
  async search(query: string, opts: { limit?: number; agentId?: string } = {}): Promise<Array<MemoryEntry & { score: number }>> {
    const filter = opts.agentId ? `agent_id == "${opts.agentId}"` : undefined;
    const hits = await searchMemories(query, { limit: opts.limit ?? 10, filter });
    if (hits.length === 0) return [];
    const entries = await Promise.all(hits.map((h) => repo.getMemoryById(h.id)));
    const out: Array<MemoryEntry & { score: number }> = [];
    for (let i = 0; i < hits.length; i++) {
      const e = entries[i];
      if (e) {
        out.push({ ...e, score: Math.round(hits[i].score * 10000) / 10000 });
        void recordMemoryRecall({ memoryId: e.id, agentId: opts.agentId ?? null, query, score: hits[i].score });
      }
    }
    return out;
  }

  /** Agent 上下文的语义召回（按目标/关注点检索，替代「取最新 N 条」）。 */
  async semanticRecall(query: string, agentId?: string, limit = 5): Promise<MemoryEntry[]> {
    return await this.search(query, { limit, agentId });
  }

  /** 从 PG 全量重建 Milvus 索引。 */
  async rebuildIndex(): Promise<{ total: number }> {
    return rebuildMemoryIndex(async () => {
      const all = await repo.getAllMemoryEntries();
      return all.map((e) => toIndexDoc(e));
    });
  }

  /** 记忆版本历史（Mongo）。 */
  async getHistory(id: string, limit = 50) {
    return getMemoryHistory(id, limit);
  }

  /** 语义索引统计（面板）。 */
  async indexStats() {
    return memoryCollectionStats();
  }
}
