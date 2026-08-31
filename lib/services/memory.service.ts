/**
 * FlowMind RAK — Memory Service
 * Business logic for memory management with versioning
 */
import * as repo from "../repositories/memory.repository";
import type { MemoryEntry, MemoryUsageStats, Pagination } from "../types";

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
  }): Promise<MemoryEntry> {
    return await repo.createMemory(data);
  }

  async update(id: string, data: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
    return await repo.updateMemory(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await repo.deleteMemory(id);
  }

  async getUsage(id: string): Promise<MemoryUsageStats | null> {
    return await repo.getMemoryUsage(id);
  }
}
