/**
 * FlowMind RAK — Agent Brain Interface
 * Defines how agents think, decide, and reflect
 */
import type { AgentConfig, JournalEntry, MemoryEntry } from "@/lib/shared/types";

export interface AgentContext {
  pendingMessages: Array<{ id: string; from: string; type: string; payload: unknown }>;
  memories: MemoryEntry[];
  activeTasks: Array<{ id: string; title: string; status: string; priority: string }>;
  risks: Array<{ id: string; level: string; title: string; resolved: boolean }>;
  systemStatus: {
    onlineAgents: number;
    busyAgents: number;
    taskQueueLength: number;
    errorRate: number;
  };
}

export interface AgentThought {
  content: string;
  type: JournalEntry["type"];
  confidence: number;
}

export interface AgentDecision {
  action: string;
  reason: string;
  target?: string;
}

export interface AgentBrain {
  think(agent: AgentConfig, context: AgentContext): Promise<AgentThought>;
  decide(agent: AgentConfig, context: AgentContext): Promise<AgentDecision | null>;
  reflect(agent: AgentConfig, recentJournal: JournalEntry[]): Promise<string>;
}
