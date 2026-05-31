/**
 * FlowMind RAK — Coordinator
 * Central coordinator: agent registry, task dispatch, message routing
 */
import * as rakRepo from "../repositories/rak.repository";
import * as agentRepo from "../repositories/agent.repository";
import type { Agent } from "../types";
import { RAK_PROTOCOL_VERSION, type RAKMessagePayload } from "./protocol";

export class Coordinator {
  // ========== Agent Registry ==========

  getAvailableAgents(requiredType?: string): Agent[] {
    const agents = agentRepo.getAgents({ status: "online" });
    if (requiredType) return agents.filter((a) => a.type === requiredType);
    return agents;
  }

  getAgentForTask(taskType: string): Agent | null {
    // Map task types to agent types
    const typeMap: Record<string, string> = {
      data_collection: "operations",
      analysis: "operations",
      risk_assessment: "risk_control",
      compliance: "legal",
      marketing: "marketing",
      advertising: "marketing",
      dispatch: "dispatch",
    };

    const preferredType = typeMap[taskType] ?? "operations";
    const agents = this.getAvailableAgents(preferredType);
    return agents[0] ?? null;
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

  broadcast(from: string, action: string, data: unknown): rakRepo.RAKMessage {
    return this.sendMessage(from, "*", action, data);
  }

  sendResponse(from: string, to: string, correlationId: string, data: unknown): rakRepo.RAKMessage {
    return rakRepo.saveMessage({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from,
      to,
      type: "response",
      protocol: RAK_PROTOCOL_VERSION,
      payload: { action: "response", data, correlationId },
      ttl: 30000,
    });
  }

  getPendingMessages(agentId: string): rakRepo.RAKMessage[] {
    return rakRepo.getMessagesForAgent(agentId, "pending");
  }

  acknowledgeMessage(messageId: string): void {
    rakRepo.updateMessageStatus(messageId, "acknowledged");
  }

  // ========== Task Dispatch ==========

  dispatchTask(taskId: string, agentIds: string[]): void {
    for (const agentId of agentIds) {
      this.sendMessage("coordinator", agentId, "assign_task", { taskId });
    }
  }
}
