/**
 * FlowMind RAK — Agent Service
 * Business logic for agent management
 */
import * as repo from "../repositories/agent.repository";
import { getRAKEngine } from "../rak";
import type { Agent, SubAgent } from "../types";

export class AgentService {
  private rak = getRAKEngine();

  async list(filters?: { status?: string; type?: string }): Promise<Agent[]> {
    return await repo.getAgents(filters);
  }

  async getById(id: string): Promise<(Agent & { subAgents: SubAgent[] }) | null> {
    return await repo.getAgentById(id);
  }

  async heartbeat(id: string): Promise<void> {
    repo.updateAgentHeartbeat(id).catch(console.error);
    this.rak.coordinator.heartbeat(id);
  }

  async updateStatus(id: string, status: string): Promise<Agent | null> {
    repo.updateAgentStatus(id, status).catch(console.error);
    return await repo.getAgentById(id) as Agent | null;
  }

  async spawnSubAgent(parentId: string, name: string, taskDescription: string): Promise<SubAgent | null> {
    const parent = await repo.getAgentById(parentId);
    if (!parent) return null;

    const sub = await repo.createSubAgent({ parentId, name, taskDescription });

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
