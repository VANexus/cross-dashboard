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

  getAvailableAgents(requiredType?: string): Agent[] {
    const agents = agentRepo.getAgents({ status: "online" });
    if (requiredType) return agents.filter((a) => a.type === requiredType);
    return agents;
  }

  heartbeat(agentId: string): void {
    agentRepo.updateAgentHeartbeat(agentId);
  }

  // ========== Message Routing ==========

  sendMessage(from: string, to: string, action: string, data: unknown): rakRepo.RAKMessage {
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

  dispatchTask(taskId: string, agentIds: string[]): void {
    for (const agentId of agentIds) {
      this.sendMessage("coordinator", agentId, "assign_task", { taskId });
    }
  }
}
