/**
 * FlowMind RAK — Risk Service
 * Business logic for risk management
 */
import * as repo from "../repositories/risk.repository";
import type { RiskEvent, HealthDimension, RiskIndicator, Pagination } from "@/lib/shared/types";

export class RiskService {
  async listEvents(filters?: {
    level?: string;
    resolved?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: RiskEvent[]; pagination: Pagination }> {
    return await repo.getRiskEvents(filters);
  }

  async createEvent(data: {
    level: string;
    title: string;
    description?: string;
    source?: string;
    actions?: string[];
  }): Promise<RiskEvent> {
    return await repo.createRiskEvent(data);
  }

  async resolveEvent(id: string, resolvedAt?: string): Promise<RiskEvent | null> {
    return await repo.updateRiskEvent(id, { resolved: true, resolvedAt });
  }

  async getHealth(): Promise<{
    score: number;
    dimensions: HealthDimension[];
    indicators: RiskIndicator[];
  }> {
    return await repo.getHealthData();
  }

  async getIsolationItems() {
    return await repo.getIsolationItems();
  }

  async updateIsolation(index: number, checked: boolean): Promise<boolean> {
    return await repo.updateIsolationItem(index, checked);
  }
}
