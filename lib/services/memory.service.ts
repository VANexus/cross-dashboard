/**
 * FlowMind RAK — Memory Service
 * Business logic for memory management with versioning
 */
import * as repo from "../repositories/memory.repository";
import type { MemoryEntry, MemoryUsageStats, Pagination } from "../types";

export class MemoryService {
  list(filters?: {
    zone?: string;
    type?: string;
    search?: string;
    agentId?: string;
    page?: number;
    pageSize?: number;
  }): { items: MemoryEntry[]; pagination: Pagination } {
    return repo.getMemoryEntries(filters);
  }

  getById(id: string): MemoryEntry | null {
    return repo.getMemoryById(id);
  }

  create(data: {
    zone: string;
    title: string;
    content: string;
    type: string;
    tags?: string[];
  }): MemoryEntry {
    return repo.createMemory(data);
  }

  update(id: string, data: Partial<MemoryEntry>): MemoryEntry | null {
    return repo.updateMemory(id, data);
  }

  delete(id: string): boolean {
    return repo.deleteMemory(id);
  }

  getUsage(id: string): MemoryUsageStats | null {
    return repo.getMemoryUsage(id);
  }
}
