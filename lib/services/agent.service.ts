/**
 * FlowMind RAK — Agent Service
 * Business logic for agent management
 */
import * as repo from "../repositories/agent.repository";
import { getRAKEngine } from "../rak";
import type { Agent, SubAgent } from "../types";

export class AgentService {
  private rak = getRAKEngine();

  list(filters?: { status?: string; type?: string }): Agent[] {
    return repo.getAgents(filters);
  }

  getById(id: string): (Agent & { subAgents: SubAgent[] }) | null {
    return repo.getAgentById(id);
  }

  heartbeat(id: string): void {
    repo.updateAgentHeartbeat(id);
    this.rak.coordinator.heartbeat(id);
  }

  updateStatus(id: string, status: string): Agent | null {
    repo.updateAgentStatus(id, status);
    return repo.getAgentById(id) as Agent | null;
  }

  spawnSubAgent(parentId: string, name: string, taskDescription: string): SubAgent | null {
    const parent = repo.getAgentById(parentId);
    if (!parent) return null;

    const sub = repo.createSubAgent({ parentId, name, taskDescription });

    // Notify parent agent via RAK
    this.rak.coordinator.sendMessage("system", parentId, "sub_agent_spawned", {
      subAgentId: sub.id,
      task: taskDescription,
    });

    return sub;
  }

  getSystemStatus() {
    return this.rak.getSystemStatus();
  }
}
