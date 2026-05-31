/**
 * FlowMind RAK — Consensus Engine
 * Byzantine fault tolerance and voting mechanism
 */
import * as rakRepo from "../repositories/rak.repository";
import type { ConsensusProposal, ConsensusVote } from "./protocol";

export class ConsensusEngine {
  // ========== Proposal Management ==========

  createProposal(data: {
    proposalId: string;
    proposer: string;
    threshold?: number;
  }): rakRepo.RAKConsensus {
    return rakRepo.saveConsensus({
      proposalId: data.proposalId,
      proposer: data.proposer,
      threshold: data.threshold ?? 0.67,
    });
  }

  // ========== Voting ==========

  vote(consensusId: string, vote: ConsensusVote): void {
    rakRepo.addVote(consensusId, vote.agentId, vote.vote, vote.weight);
  }

  // ========== Resolution ==========

  tallyVotes(consensusId: string): {
    accept: number;
    reject: number;
    abstain: number;
    total: number;
    passed: boolean;
  } {
    const consensus = rakRepo.getConsensus(consensusId);
    if (!consensus) {
      return { accept: 0, reject: 0, abstain: 0, total: 0, passed: false };
    }

    const voters = consensus.voters;
    const accept = voters.filter((v) => v.vote === "accept").length;
    const reject = voters.filter((v) => v.vote === "reject").length;
    const abstain = voters.filter((v) => v.vote === "abstain").length;
    const total = voters.length;
    const totalWeight = voters.reduce((sum, v) => sum + v.weight, 0);
    const acceptWeight = voters.filter((v) => v.vote === "accept").reduce((sum, v) => sum + v.weight, 0);
    const passed = totalWeight > 0 ? acceptWeight / totalWeight >= consensus.threshold : false;

    return { accept, reject, abstain, total, passed };
  }

  resolve(consensusId: string, votes: ConsensusVote[], threshold: number): {
    status: "accepted" | "rejected";
    acceptRate: number;
    result: unknown;
  } {
    const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
    const acceptWeight = votes.filter((v) => v.vote === "accept").reduce((sum, v) => sum + v.weight, 0);
    const acceptRate = totalWeight > 0 ? acceptWeight / totalWeight : 0;

    const status = acceptRate >= threshold ? "accepted" : "rejected";

    rakRepo.resolveConsensus(consensusId, status, {
      acceptRate,
      votes: votes.map((v) => ({ agentId: v.agentId, vote: v.vote, weight: v.weight })),
    });

    return {
      status,
      acceptRate,
      result: { acceptRate, threshold, votes: votes.length },
    };
  }

  // ========== Byzantine Fault Detection ==========

  detectByzantineFaults(votes: ConsensusVote[]): {
    suspicious: string[];
    reason: string;
  }[] {
    const faults: { suspicious: string[]; reason: string }[] = [];

    // Detect: single agent voting differently from all others
    if (votes.length >= 3) {
      const acceptAgents = votes.filter((v) => v.vote === "accept").map((v) => v.agentId);
      const rejectAgents = votes.filter((v) => v.vote === "reject").map((v) => v.agentId);

      if (acceptAgents.length === 1 && rejectAgents.length >= 2) {
        faults.push({
          suspicious: acceptAgents,
          reason: "Single agent disagrees with majority — possible Byzantine fault",
        });
      }
      if (rejectAgents.length === 1 && acceptAgents.length >= 2) {
        faults.push({
          suspicious: rejectAgents,
          reason: "Single agent disagrees with majority — possible Byzantine fault",
        });
      }
    }

    // Detect: all agents abstaining
    const abstainCount = votes.filter((v) => v.vote === "abstain").length;
    if (abstainCount === votes.length && votes.length > 0) {
      faults.push({
        suspicious: votes.map((v) => v.agentId),
        reason: "All agents abstained — no consensus possible",
      });
    }

    return faults;
  }
}
