/**
 * FlowMind RAK — Evolution Service
 * Business logic for evolution tracking
 */
import * as repo from "../repositories/evolution.repository";
import * as journalRepo from "../repositories/journal.repository";
import * as memoryRepo from "../repositories/memory.repository";
import { agentEventBus } from "../agent-runtime/event-bus";
import type { EvolutionRecord, Pagination } from "../types";

export class EvolutionService {
  async list(filters?: {
    stage?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: EvolutionRecord[]; pagination: Pagination }> {
    return await repo.getEvolutionRecords(filters);
  }

  async getById(id: string): Promise<EvolutionRecord | null> {
    return await repo.getEvolutionById(id);
  }

  async create(data: {
    stage: string;
    title: string;
    description?: string;
    agentId: string;
  }): Promise<EvolutionRecord> {
    return await repo.createEvolution(data);
  }

  async update(id: string, data: Partial<EvolutionRecord>): Promise<EvolutionRecord | null> {
    const record = await repo.updateEvolution(id, data);

    if (data.status === "success" && record) {
      this.onEvolutionSuccess(record).catch(console.error);
    }

    return record;
  }

  async getTrend(months?: number) {
    return await repo.getEvolutionTrend(months);
  }

  private async onEvolutionSuccess(record: EvolutionRecord): Promise<void> {
    const agentId = record.agentId;
    const now = new Date().toISOString();

    try {
      await memoryRepo.createMemory({
        zone: "agent",
        title: `新能力: ${record.title}`,
        content: record.description || `进化「${record.title}」成功完成，阶段: ${record.stage}`,
        type: "insight",
        tags: ["evolution", "capability", record.id],
        agentId,
      });
    } catch { /* non-critical */ }

    try {
      await journalRepo.addEntry({
        agentId,
        type: "reflection",
        content: `进化「${record.title}」成功完成，新能力已上线。阶段: ${record.stage}`,
        context: { evolutionId: record.id, stage: record.stage },
      });
    } catch { /* non-critical */ }

    agentEventBus.emit(agentId, {
      type: "reflection",
      agentId,
      data: { action: "evolution_success", evolutionId: record.id, title: record.title },
      timestamp: now,
    });
  }
}
