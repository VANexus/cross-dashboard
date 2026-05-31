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
  list(filters?: {
    stage?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): { items: EvolutionRecord[]; pagination: Pagination } {
    return repo.getEvolutionRecords(filters);
  }

  getById(id: string): EvolutionRecord | null {
    return repo.getEvolutionById(id);
  }

  create(data: {
    stage: string;
    title: string;
    description?: string;
    agentId: string;
  }): EvolutionRecord {
    return repo.createEvolution(data);
  }

  update(id: string, data: Partial<EvolutionRecord>): EvolutionRecord | null {
    const record = repo.updateEvolution(id, data);

    // Feedback loop: when evolution succeeds, create capability memory
    if (data.status === "success" && record) {
      this.onEvolutionSuccess(record);
    }

    return record;
  }

  getTrend(months?: number) {
    return repo.getEvolutionTrend(months);
  }

  private onEvolutionSuccess(record: EvolutionRecord): void {
    const agentId = record.agentId;
    const now = new Date().toISOString();

    // Create capability memory
    try {
      memoryRepo.createMemory({
        zone: "agent",
        title: `新能力: ${record.title}`,
        content: record.description || `进化「${record.title}」成功完成，阶段: ${record.stage}`,
        type: "insight",
        tags: ["evolution", "capability", record.id],
        agentId,
      });
    } catch { /* non-critical */ }

    // Write journal entry
    try {
      journalRepo.addEntry({
        agentId,
        type: "reflection",
        content: `进化「${record.title}」成功完成，新能力已上线。阶段: ${record.stage}`,
        context: { evolutionId: record.id, stage: record.stage },
      });
    } catch { /* non-critical */ }

    // Emit event
    agentEventBus.emit(agentId, {
      type: "reflection",
      agentId,
      data: { action: "evolution_success", evolutionId: record.id, title: record.title },
      timestamp: now,
    });
  }
}
