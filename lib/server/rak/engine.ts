/**
 * FlowMind RAK — Engine
 * Top-level orchestrator: agent registry, message routing, DAG execution
 */
import { Coordinator } from "./coordinator";
import { MeshExecutor } from "./mesh";

export class RAKEngine {
  readonly coordinator: Coordinator;
  readonly mesh: MeshExecutor;

  constructor() {
    this.coordinator = new Coordinator();
    this.mesh = new MeshExecutor();
  }

  // ========== System status ==========

  async getSystemStatus() {
    const agents = await this.coordinator.getAvailableAgents();
    return {
      onlineAgents: agents.length,
      agentTypes: [...new Set(agents.map((a) => a.type))],
      timestamp: new Date().toISOString(),
    };
  }
}

// Singleton
let _engine: RAKEngine | null = null;

export function getRAKEngine(): RAKEngine {
  if (!_engine) _engine = new RAKEngine();
  return _engine;
}
