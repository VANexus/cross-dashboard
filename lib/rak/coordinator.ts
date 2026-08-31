/**
 * FlowMind RAK — Coordinator
 * Central coordinator: agent registry, task dispatch, message routing
 */
import * as rakRepo from "../repositories/rak.repository";
import * as agentRepo from "../repositories/agent.repository";
import type { Agent } from "../types";
import { RAK_PROTOCOL_VERSION } from "./protocol";

export class Coordinator {
  // ========== Agent Registry ==========

  async getAvailableAgents(requiredType?: string): Promise<Agent[]> {
    const agents = await agentRepo.getAgents({ status: "online" });
    if (requiredType) return agents.filter((a) => a.type === requiredType);
    return agents;
  }

  async heartbeat(agentId: string): Promise<void> {
    await agentRepo.updateAgentHeartbeat(agentId);
  }

  // ========== Message Routing ==========

  async sendMessage(from: string, to: string, action: string, data: unknown): Promise<rakRepo.RAKMessage> {
    return rakRepo.saveMessage({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from,
      to,
      type: "request",
      protocol: RAK_PROTOCOL_VERSION,
      payload: { action, data },
      ttl: 30000,
    });
  }

  // ========== Task Dispatch ==========

  async dispatchTask(taskId: string, agentIds: string[]): Promise<void> {
    for (const agentId of agentIds) {
      await this.sendMessage("coordinator", agentId, "assign_task", { taskId });
    }
  }
}
