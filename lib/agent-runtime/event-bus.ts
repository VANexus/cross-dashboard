/**
 * FlowMind RAK — Agent Event Bus
 * In-memory pub/sub for real-time agent events (SSE)
 */
import type { AgentEvent } from "../types";

type Listener = (event: AgentEvent) => void;

class AgentEventBus {
  private agentListeners = new Map<string, Set<Listener>>();
  private globalListeners = new Set<Listener>();

  subscribe(agentId: string, listener: Listener): () => void {
    if (!this.agentListeners.has(agentId)) {
      this.agentListeners.set(agentId, new Set());
    }
    this.agentListeners.get(agentId)!.add(listener);
    return () => { this.agentListeners.get(agentId)?.delete(listener); };
  }

  subscribeAll(listener: Listener): () => void {
    this.globalListeners.add(listener);
    return () => { this.globalListeners.delete(listener); };
  }

  emit(agentId: string, event: AgentEvent): void {
    this.agentListeners.get(agentId)?.forEach((l) => l(event));
    this.globalListeners.forEach((l) => l(event));
  }
}

export const agentEventBus = new AgentEventBus();
