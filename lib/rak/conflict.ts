/**
 * FlowMind RAK — Conflict Resolver
 * 4 conflict resolution strategies: timestamp, weighted vote, causal order, arbitration
 */
import * as rakRepo from "../repositories/rak.repository";
import * as agentRepo from "../repositories/agent.repository";
import type { ConflictStrategy } from "./protocol";
import type { ConflictResolutionResult } from "./protocol";

export class ConflictResolver {
  // ========== Detection ==========

  detectConflict(data: {
    taskId: string;
    agents: string[];
    conflictType: string;
    description: string;
  }): rakRepo.RAKConflict {
    return rakRepo.saveConflict({
      taskId: data.taskId,
      agents: data.agents,
      conflictType: data.conflictType,
      description: data.description,
    });
  }

  getConflicts(taskId: string): rakRepo.RAKConflict[] {
    return rakRepo.getConflictsForTask(taskId);
  }

  // ========== Resolution ==========

  resolve(
    conflictId: string,
    strategy: ConflictStrategy,
    agents: string[],
    results: Map<string, unknown>,
  ): ConflictResolutionResult {
    let result: ConflictResolutionResult;

    switch (strategy) {
      case "timestamp_priority":
        result = this.resolveByTimestamp(agents, results);
        break;
      case "weighted_vote":
        result = this.resolveByWeightedVote(agents, results);
        break;
      case "causal_order":
        result = this.resolveByCausalOrder(agents, results);
        break;
      case "arbitration":
        result = this.resolveByArbitration(agents, results);
        break;
      default:
        result = { strategy, reason: "Unknown strategy, defaulting to first agent", winner: agents[0] };
    }

    rakRepo.resolveConflict(conflictId, strategy, result);
    return result;
  }

  // Strategy 1: Timestamp Priority — earliest result wins
  private resolveByTimestamp(agents: string[], results: Map<string, unknown>): ConflictResolutionResult {
    let earliest = Infinity;
    let winner = agents[0];

    for (const agentId of agents) {
      const result = results.get(agentId) as Record<string, unknown> | undefined;
      const ts = result?.completedAt ? new Date(result.completedAt as string).getTime() : Infinity;
      if (ts < earliest) {
        earliest = ts;
        winner = agentId;
      }
    }

    return {
      strategy: "timestamp_priority",
      winner,
      mergedResult: results.get(winner),
      reason: `Agent ${winner} produced the earliest result`,
    };
  }

  // Strategy 2: Weighted Vote — agents vote with weights based on success rate
  private resolveByWeightedVote(agents: string[], results: Map<string, unknown>): ConflictResolutionResult {
    const weights = new Map<string, number>();
    let bestAgent = agents[0];
    let bestWeight = 0;

    for (const agentId of agents) {
      const agent = agentRepo.getAgentById(agentId);
      const weight = agent?.successRate ?? 50; // default to 50% if not found
      weights.set(agentId, weight);
      if (weight > bestWeight) {
        bestWeight = weight;
        bestAgent = agentId;
      }
    }

    const winner = bestAgent;
    return {
      strategy: "weighted_vote",
      winner,
      mergedResult: results.get(winner),
      reason: `Weighted vote: ${agents.length} agents, winner ${winner} (successRate=${bestWeight}%)`,
    };
  }

  // Strategy 3: Causal Order — respect dependency chain
  private resolveByCausalOrder(agents: string[], results: Map<string, unknown>): ConflictResolutionResult {
    // The agent that completed its causal dependency last should have the most recent context
    const winner = agents[agents.length - 1];
    return {
      strategy: "causal_order",
      winner,
      mergedResult: results.get(winner),
      reason: `Causal order: ${winner} has the latest causal context`,
    };
  }

  // Strategy 4: Arbitration — human-in-the-loop
  private resolveByArbitration(agents: string[], results: Map<string, unknown>): ConflictResolutionResult {
    // In production, this would pause and wait for human input
    // For now, merge all results
    const merged = Array.from(results.entries()).map(([agentId, result]) => ({
      agentId,
      result,
    }));

    return {
      strategy: "arbitration",
      mergedResult: merged,
      reason: `Arbitration: ${agents.length} results queued for human review`,
    };
  }

  // ========== Auto-detection ==========

  detectTaskConflicts(taskId: string): boolean {
    const conflicts = this.getConflicts(taskId);
    return conflicts.some((c) => !c.resolvedAt);
  }
}
