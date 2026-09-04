/**
 * FlowMind RAK — Agent Runtime Engine
 * Per-agent setInterval loops: wake → context → think → journal → decide → mood → emit
 */
import { prisma } from "../db";
import * as agentRepo from "../repositories/agent.repository";
import * as journalRepo from "../repositories/journal.repository";
import * as rakRepo from "../repositories/rak.repository";
import { MemoryService } from "../services/memory.service";
import { evolutionEngine } from "../services/evolution-engine.service";
import { AIConfigError } from "../ai";
import { agentEventBus } from "./event-bus";
import { assembleContext } from "./context";
import { RealAgentBrain } from "./real-brain";
import { reflexThink, reflexDecide, reflexReflect } from "./reflex";
import type { AgentConfig, MoodState, AgentEvent } from "@/lib/shared/types";

const brain = new RealAgentBrain();
const memoryService = new MemoryService();

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

  async start(): Promise<void> {
    const agents = await agentRepo.getAgents();
    console.log(`[AgentRuntime] start(): found ${agents.length} agents`);
    await Promise.all(
      agents
        .filter((agent) => agent.config?.cycleConfig?.enabled !== false)
        .map((agent) => this.startAgent(agent.id).catch((e) => console.warn(`[AgentRuntime] startAgent(${agent.id}) failed:`, e.message))),
    );
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

  async startAgent(agentId: string): Promise<void> {
    if (this.timers.has(agentId)) return;

    const agent = await agentRepo.getAgentById(agentId);
    const interval = agent?.config?.cycleConfig?.intervalMs ?? 45000;
    // Add jitter (±20%) to avoid all agents firing simultaneously
    const jitter = interval * (0.8 + Math.random() * 0.4);

    this.running.set(agentId, false);
    this.cycleCount.set(agentId, 0);

    const timer = setInterval(() => void this.runCycle(agentId).catch(console.error), jitter);
    this.timers.set(agentId, timer);

    // 立即跑首个循环（秒级出活体数据；后续按 interval+jitter 节律）
    void this.runCycle(agentId).catch(console.error);
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

  /** 手动单次循环（API「立即运行」）：同步执行一轮 wake→context→think→decide→mood→emit。 */
  async runOnce(agentId: string): Promise<{ ok: boolean; error?: string; cycle?: number }> {
    // 并发守卫由 runCycle 自身维护；这里只做前置忙碌检测，不占用 running 标志，
    // 否则 runCycle 入口的 `if (this.running.get(agentId)) return` 会立即短路。
    if (this.running.get(agentId)) {
      return { ok: false, error: "上一循环仍在执行中" };
    }
    try {
      await this.runCycle(agentId);
      return { ok: true, cycle: this.cycleCount.get(agentId) ?? 1 };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  /** 是否已在运行循环（面板展示）。 */
  isRunning(agentId: string): boolean {
    return this.timers.has(agentId);
  }

  private async runCycle(agentId: string): Promise<void> {
    // Guard: skip if previous cycle still running
    if (this.running.get(agentId)) return;
    this.running.set(agentId, true);

    try {
      const agent = await agentRepo.getAgentById(agentId);
      if (!agent?.config?.persona?.expertise) {
        this.running.set(agentId, false);
        return;
      }

      const config = agent.config;
      const cycles = (this.cycleCount.get(agentId) ?? 0) + 1;
      this.cycleCount.set(agentId, cycles);

      // 1. Wake: update heartbeat
      agentRepo.updateAgentHeartbeat(agentId).catch(console.error);

      // 2. Assemble context
      const context = await assembleContext(agentId);

      // 3. Think（LLM 可用 → 深思；否则 → 确定性反射，均为真实状态数据）
      let thought: Awaited<ReturnType<RealAgentBrain["think"]>>;
      try {
        thought = await brain.think(config, context);
      } catch (e) {
        if (e instanceof AIConfigError) {
          thought = reflexThink(agent.config, agent.name, context);
        } else {
          throw e;
        }
      }

      // 4. Write journal
      journalRepo.addEntry({
        agentId,
        type: thought.type,
        content: thought.content,
        context: { confidence: thought.confidence, cycle: cycles },
        moodAt: config.mood.state,
      }).catch(console.error);

      // Emit thought event
      this.emit(agentId, {
        type: thought.type as AgentEvent["type"],
        agentId,
        data: { content: thought.content, confidence: thought.confidence },
        timestamp: new Date().toISOString(),
      });

      // 5. Decide & Act（LLM 可用 → 深思；否则 → 反射规则）
      let decision: Awaited<ReturnType<RealAgentBrain["decide"]>>;
      try {
        decision = await brain.decide(config, context);
      } catch (e) {
        if (e instanceof AIConfigError) {
          decision = reflexDecide(agent.config, context);
        } else {
          throw e;
        }
      }
      if (decision) {
        journalRepo.addEntry({
          agentId,
          type: "decision",
          content: `${decision.action}: ${decision.reason}`,
          context: { action: decision.action, target: decision.target },
          moodAt: config.mood.state,
        }).catch(console.error);

        this.emit(agentId, {
          type: "decision",
          agentId,
          data: { action: decision.action, reason: decision.reason, target: decision.target },
          timestamp: new Date().toISOString(),
        });

        // Execute side effects based on action
        void this.executeAction(agentId, decision.action, decision.target);
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
      agentRepo.updateAgentConfig(agentId, nudgedConfig).catch(console.error);

      // 8. Every 10th cycle: reflect + consolidate memories + 自进化闭环
      if (cycles % 10 === 0) {
        const recentJournal = await journalRepo.getEntries(agentId, 10);
        let reflection: string;
        try {
          reflection = await brain.reflect(config, recentJournal);
        } catch (e) {
          if (e instanceof AIConfigError) {
            reflection = reflexReflect(agent.config, agent.name, recentJournal);
          } else {
            throw e;
          }
        }
        journalRepo.addEntry({
          agentId,
          type: "reflection",
          content: reflection,
          context: { cycle: cycles },
          moodAt: config.mood.state,
        }).catch(console.error);

        this.emit(agentId, {
          type: "reflection",
          agentId,
          data: { content: reflection },
          timestamp: new Date().toISOString(),
        });

        // 反思记忆经 MemoryService 落地：PG + Milvus 语义索引 + Mongo 版本历史
        try {
          await memoryService.create({
            zone: "agent",
            title: `${agent.name} 反思 #${Math.floor(cycles / 10)}`,
            content: reflection,
            type: "insight",
            tags: ["auto-generated", agent.name],
            agentId,
          });
        } catch (e) {
          console.error(`[AgentRuntime] reflection memory failed for ${agentId}:`, e);
        }

        this.emit(agentId, {
          type: "memory_created",
          agentId,
          data: { title: `反思 #${Math.floor(cycles / 10)}`, source: "reflection" },
          timestamp: new Date().toISOString(),
        });

        // 自进化闭环：调用 EvolutionEngine 跑完整五阶段（内部含 Redis 锁 + Mongo 审计）
        evolutionEngine
          .run({ agentId, source: "auto" })
          .then((res) => {
            if (res.skipped) console.log(`[AgentRuntime] evolution skipped for ${agentId}: ${res.reason}`);
            else console.log(`[AgentRuntime] evolution done for ${agentId}: stages=${res.stages.join(">")}`);
          })
          .catch((e) => console.error(`[AgentRuntime] evolution failed for ${agentId}:`, e));
      }
    } catch (err) {
      console.error(`[AgentRuntime] Cycle error for ${agentId}:`, err);
    } finally {
      this.running.set(agentId, false);
    }
  }

  private async executeAction(agentId: string, action: string, target?: string): Promise<void> {
    // Send message to other agents based on action
    if (action === "send_alert" || action === "escalate_risk") {
      const dispatchId = "dispatch-001";
      if (dispatchId !== agentId) {
        rakRepo.saveMessage({
          id: `msg-${Date.now()}`,
          from: agentId,
          to: dispatchId,
          type: "event",
          protocol: "runtime",
          payload: { action, data: { target, timestamp: new Date().toISOString() } },
          ttl: 3600,
        }).catch(console.error);
      }
    }

    // Update task priority if requested
    if (action === "update_priority" && target) {
      try {
        await prisma.tasks.updateMany({
          where: { id: target },
          data: { priority: "high", updated_at: new Date().toISOString() },
        });
      } catch (e) {
        console.error("[AgentRuntime] update_priority failed:", e);
      }
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

// Turbopack/Next 会把本模块编译进多个 chunk（SSR、route handler、db 层各一份），
// 每份若各自 new 一个 AgentRuntime，则 timers/running/cycleCount 各持一份，
// 导致「boot 未启动定时器 / runOnce 误判忙碌 / stop 清不掉另一份的 timer」等发散行为。
// 因此用 globalThis 挂进程级真单例，所有副本共享同一份运行时状态。
const g = globalThis as unknown as { __flowmindAgentRuntime?: AgentRuntime };
export const agentRuntime: AgentRuntime = g.__flowmindAgentRuntime ?? (g.__flowmindAgentRuntime = new AgentRuntime());
