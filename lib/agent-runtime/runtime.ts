/**
 * FlowMind RAK — Agent Runtime Engine
 * Per-agent setInterval loops: wake → context → think → journal → decide → mood → emit
 */
import { getDb } from "../db";
import * as agentRepo from "../repositories/agent.repository";
import * as journalRepo from "../repositories/journal.repository";
import * as memoryRepo from "../repositories/memory.repository";
import { agentEventBus } from "./event-bus";
import { assembleContext } from "./context";
import { RealAgentBrain } from "./real-brain";
import type { AgentConfig, MoodState, AgentEvent } from "../types";

const brain = new RealAgentBrain();

// Mood state machine: transitions based on activity and energy
const moodTransitions: Record<MoodState, { lowEnergy: MoodState; highActivity: MoodState; idle: MoodState }> = {
  focused:   { lowEnergy: "tired",    highActivity: "stressed",  idle: "curious"   },
  alert:     { lowEnergy: "tired",    highActivity: "stressed",  idle: "focused"   },
  tired:     { lowEnergy: "tired",    highActivity: "stressed",  idle: "satisfied" },
  stressed:  { lowEnergy: "tired",    highActivity: "stressed",  idle: "focused"   },
  curious:   { lowEnergy: "tired",    highActivity: "focused",   idle: "satisfied" },
  satisfied: { lowEnergy: "tired",    highActivity: "focused",   idle: "curious"   },
};

function updateMood(config: AgentConfig, hadDecision: boolean, hadRisk: boolean): AgentConfig {
  let { state, energy } = config.mood;

  // Energy decay per cycle, recovery when idle
  energy = hadDecision ? Math.max(0.1, energy - 0.03) : Math.min(1, energy + 0.01);
  if (hadRisk) energy = Math.max(0.1, energy - 0.05);

  // State transitions
  const transitions = moodTransitions[state];
  if (energy < 0.3) {
    state = transitions.lowEnergy;
  } else if (hadDecision || hadRisk) {
    state = transitions.highActivity;
  } else if (Math.random() < 0.15) {
    state = transitions.idle;
  }

  return {
    ...config,
    mood: { state, energy, lastUpdated: new Date().toISOString() },
  };
}

class AgentRuntime {
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private running = new Map<string, boolean>();
  private cycleCount = new Map<string, number>();

  start(): void {
    const agents = agentRepo.getAgents();
    for (const agent of agents) {
      if (agent.config?.cycleConfig?.enabled !== false) {
        this.startAgent(agent.id);
      }
    }
    console.log(`[AgentRuntime] Started ${this.timers.size} agent cycles`);
  }

  stop(): void {
    for (const [id, timer] of this.timers) {
      clearInterval(timer);
      this.timers.delete(id);
    }
    this.running.clear();
    this.cycleCount.clear();
    console.log("[AgentRuntime] Stopped all agent cycles");
  }

  startAgent(agentId: string): void {
    if (this.timers.has(agentId)) return;

    const agent = agentRepo.getAgentById(agentId);
    const interval = agent?.config?.cycleConfig?.intervalMs ?? 45000;
    // Add jitter (±20%) to avoid all agents firing simultaneously
    const jitter = interval * (0.8 + Math.random() * 0.4);

    this.running.set(agentId, false);
    this.cycleCount.set(agentId, 0);

    const timer = setInterval(() => this.runCycle(agentId), jitter);
    this.timers.set(agentId, timer);
  }

  stopAgent(agentId: string): void {
    const timer = this.timers.get(agentId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(agentId);
    }
    this.running.delete(agentId);
    this.cycleCount.delete(agentId);
  }

  private async runCycle(agentId: string): Promise<void> {
    // Guard: skip if previous cycle still running
    if (this.running.get(agentId)) return;
    this.running.set(agentId, true);

    try {
      const agent = agentRepo.getAgentById(agentId);
      if (!agent?.config?.persona?.expertise) {
        this.running.set(agentId, false);
        return;
      }

      const config = agent.config;
      const cycles = (this.cycleCount.get(agentId) ?? 0) + 1;
      this.cycleCount.set(agentId, cycles);

      // 1. Wake: update heartbeat
      agentRepo.updateAgentHeartbeat(agentId);

      // 2. Assemble context
      const context = assembleContext(agentId);

      // 3. Think
      const thought = await brain.think(config, context);

      // 4. Write journal
      journalRepo.addEntry({
        agentId,
        type: thought.type,
        content: thought.content,
        context: { confidence: thought.confidence, cycle: cycles },
        moodAt: config.mood.state,
      });

      // Emit thought event
      this.emit(agentId, {
        type: thought.type as AgentEvent["type"],
        agentId,
        data: { content: thought.content, confidence: thought.confidence },
        timestamp: new Date().toISOString(),
      });

      // 5. Decide & Act
      const decision = await brain.decide(config, context);
      if (decision) {
        journalRepo.addEntry({
          agentId,
          type: "decision",
          content: `${decision.action}: ${decision.reason}`,
          context: { action: decision.action, target: decision.target },
          moodAt: config.mood.state,
        });

        this.emit(agentId, {
          type: "decision",
          agentId,
          data: { action: decision.action, reason: decision.reason, target: decision.target },
          timestamp: new Date().toISOString(),
        });

        // Execute side effects based on action
        this.executeAction(agentId, decision.action, decision.target);
      }

      // 6. Update mood
      const hadDecision = !!decision;
      const hasRisk = context.risks.length > 2;
      const updatedConfig = updateMood(config, hadDecision, hasRisk);

      // Emit mood change if state changed
      if (updatedConfig.mood.state !== config.mood.state) {
        this.emit(agentId, {
          type: "mood_change",
          agentId,
          data: { from: config.mood.state, to: updatedConfig.mood.state, energy: updatedConfig.mood.energy },
          timestamp: new Date().toISOString(),
        });
      }

      // 7. Save updated config (mood + goal progress nudge)
      const nudgedConfig = this.nudgeGoalProgress(updatedConfig, cycles);
      agentRepo.updateAgentConfig(agentId, nudgedConfig);

      // 8. Every 10th cycle: reflect + consolidate memories
      if (cycles % 10 === 0) {
        const recentJournal = journalRepo.getEntries(agentId, 10);
        const reflection = await brain.reflect(config, recentJournal);
        journalRepo.addEntry({
          agentId,
          type: "reflection",
          content: reflection,
          context: { cycle: cycles },
          moodAt: config.mood.state,
        });

        this.emit(agentId, {
          type: "reflection",
          agentId,
          data: { content: reflection },
          timestamp: new Date().toISOString(),
        });

        // Auto-create memory from reflection
        memoryRepo.createMemory({
          zone: "agent",
          title: `${agent.name} 反思 #${Math.floor(cycles / 10)}`,
          content: reflection,
          type: "insight",
          tags: ["auto-generated", agent.name],
          agentId,
        });

        this.emit(agentId, {
          type: "memory_created",
          agentId,
          data: { title: `反思 #${Math.floor(cycles / 10)}` },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`[AgentRuntime] Cycle error for ${agentId}:`, err);
    } finally {
      this.running.set(agentId, false);
    }
  }

  private executeAction(agentId: string, action: string, target?: string): void {
    const db = getDb();

    // Send message to other agents based on action
    if (action === "send_alert" || action === "escalate_risk") {
      const dispatchId = "dispatch-001";
      if (dispatchId !== agentId) {
        db.run(
          "INSERT INTO rak_messages (id, from_agent, to_agent, type, payload, status) VALUES (?, ?, ?, ?, ?, ?)",
          [`msg-${Date.now()}`, agentId, dispatchId, "notification",
           JSON.stringify({ action, target, timestamp: new Date().toISOString() }), "pending"]
        );
      }
    }

    // Update task priority if requested
    if (action === "update_priority" && target) {
      db.run("UPDATE tasks SET priority = 'high', updated_at = datetime('now') WHERE id = ?", [target]);
    }
  }

  private nudgeGoalProgress(config: AgentConfig, cycles: number): AgentConfig {
    // Very slowly nudge goal progress upward over time (simulates gradual improvement)
    if (cycles % 5 !== 0) return config;

    const goals = config.goals.map((g) => ({
      ...g,
      progress: Math.min(1, g.progress + (Math.random() * 0.02)),
    }));

    return { ...config, goals };
  }

  private emit(agentId: string, event: AgentEvent): void {
    agentEventBus.emit(agentId, event);
  }
}

export const agentRuntime = new AgentRuntime();
