/**
 * FlowMind RAK — Engine
 * Top-level orchestrator: coordinates all RAK subsystems
 */
import { Coordinator } from "./coordinator";
import { MeshExecutor } from "./mesh";
import { ConflictResolver } from "./conflict";
import { ConsensusEngine } from "./consensus";
import type { DAGDefinition, ConflictStrategy } from "./protocol";

export class RAKEngine {
  readonly coordinator: Coordinator;
  readonly mesh: MeshExecutor;
  readonly conflict: ConflictResolver;
  readonly consensus: ConsensusEngine;

  constructor() {
    this.coordinator = new Coordinator();
    this.mesh = new MeshExecutor();
    this.conflict = new ConflictResolver();
    this.consensus = new ConsensusEngine();
  }

  // ========== High-level task orchestration ==========

  /**
   * Execute a task through the full RAK pipeline:
   * 1. Coordinator dispatches to agents
   * 2. Mesh executor runs DAG in parallel
   * 3. Conflicts detected and resolved
   * 4. Consensus on final result
   */
  async executeTask(taskId: string, definition: DAGDefinition): Promise<{
    success: boolean;
    results: Map<string, unknown>;
    conflicts: number;
    consensusRate: number;
  }> {
    // 1. Create DAG
    const nodes = this.mesh.createDAG(taskId, definition);

    // 2. Dispatch agents
    for (const node of definition.nodes) {
      if (node.assignedAgent) {
        this.coordinator.sendMessage("engine", node.assignedAgent, "assign_dag_node", {
          taskId,
          nodeId: `${taskId}-${node.id}`,
          nodeName: node.name,
        });
      }
    }

    // 3. Execute ready nodes (simulation — in production this would be event-driven)
    const results = new Map<string, unknown>();
    let conflictCount = 0;

    const levels = this.mesh.getExecutionOrder(taskId);
    for (const level of levels) {
      for (const nodeId of level) {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node || node.type === "start" || node.type === "end") {
          this.mesh.completeNode(nodeId, taskId);
          continue;
        }

        this.mesh.startNode(nodeId, taskId);

        // Simulate execution
        const result = { nodeId, status: "completed", timestamp: new Date().toISOString() };
        results.set(nodeId, result);
        this.mesh.completeNode(nodeId, taskId, result);
      }
    }

    // 4. Check for conflicts
    const hasConflicts = this.conflict.detectTaskConflicts(taskId);
    if (hasConflicts) {
      conflictCount++;
      // Auto-resolve with timestamp priority
      const conflicts = this.conflict.getConflicts(taskId);
      for (const c of conflicts) {
        if (!c.resolvedAt) {
          this.conflict.resolve(c.id, "timestamp_priority", c.agents, results);
        }
      }
    }

    // 5. Consensus on result
    const proposal = this.consensus.createProposal({
      proposalId: `prop-${taskId}`,
      proposer: "engine",
      threshold: 0.67,
    });

    // Simulate voting from available agents
    const agents = this.coordinator.getAvailableAgents();
    const votes = agents.slice(0, 3).map((a) => ({
      agentId: a.id,
      vote: "accept" as const,
      weight: a.successRate / 100,
      reason: "Task completed successfully",
    }));

    const consensusResult = this.consensus.resolve(proposal.id, votes, 0.67);

    return {
      success: this.mesh.isComplete(taskId) && !this.mesh.hasFailures(taskId),
      results,
      conflicts: conflictCount,
      consensusRate: consensusResult.acceptRate,
    };
  }

  // ========== Agent communication ==========

  sendAgentMessage(from: string, to: string, action: string, data: unknown) {
    return this.coordinator.sendMessage(from, to, action, data);
  }

  broadcastToAgents(from: string, action: string, data: unknown) {
    return this.coordinator.broadcast(from, action, data);
  }

  getAgentMessages(agentId: string) {
    return this.coordinator.getPendingMessages(agentId);
  }

  // ========== System status ==========

  getSystemStatus() {
    const agents = this.coordinator.getAvailableAgents();
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
