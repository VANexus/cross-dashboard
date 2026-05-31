/**
 * FlowMind RAK — Risk Service
 * Business logic for risk management
 */
import * as repo from "../repositories/risk.repository";
import type { RiskEvent, HealthDimension, RiskIndicator, Pagination } from "../types";

export class RiskService {
  listEvents(filters?: {
    level?: string;
    resolved?: boolean;
    page?: number;
    pageSize?: number;
  }): { items: RiskEvent[]; pagination: Pagination } {
    return repo.getRiskEvents(filters);
  }

  createEvent(data: {
    level: string;
    title: string;
    description?: string;
    source?: string;
    actions?: string[];
  }): RiskEvent {
    return repo.createRiskEvent(data);
  }

  resolveEvent(id: string, resolvedAt?: string): RiskEvent | null {
    return repo.updateRiskEvent(id, { resolved: true, resolvedAt });
  }

  getHealth(): {
    score: number;
    dimensions: HealthDimension[];
    indicators: RiskIndicator[];
  } {
    return repo.getHealthData();
  }

  getIsolationItems() {
    return repo.getIsolationItems();
  }

  updateIsolation(index: number, checked: boolean): boolean {
    return repo.updateIsolationItem(index, checked);
  }
}
