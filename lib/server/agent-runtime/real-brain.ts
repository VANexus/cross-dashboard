/**
 * FlowMind RAK — Real AI Brain
 * Uses LLM for agent reasoning；无 LLM 配置时抛 AIConfigError（由 runtime 捕获，不出假决策）。
 */
import { getAIProvider } from "../ai";
import type { AgentBrain, AgentContext, AgentThought, AgentDecision } from "./brain";
import type { AgentConfig, JournalEntry } from "@/lib/shared/types";

function buildThinkPrompt(agent: AgentConfig, context: AgentContext): { system: string; data: unknown } {
  const { persona, goals, mood } = agent;
  const goalSummary = goals.map((g) => `- ${g.text} (进度: ${Math.round(g.progress * 100)}%, 优先级: ${g.priority})`).join("\n");
  const msgSummary = context.pendingMessages.map((m) => `[${m.from}] ${m.type}: ${JSON.stringify(m.payload)}`).join("\n") || "无待处理消息";
  const taskSummary = context.activeTasks.map((t) => `- ${t.title} [${t.priority}]`).join("\n") || "无活跃任务";
  const riskSummary = context.risks.map((r) => `- [${r.level}] ${r.title}`).join("\n") || "无风险事件";
  const memSummary = context.memories.map((m) => `- ${m.title}`).join("\n") || "无记忆";
  const sys = context.systemStatus;

  const system = `${persona.systemPrompt}

你的沟通风格是"${persona.communicationStyle}"，专业领域：${persona.expertise.join("、")}。
当前情绪状态：${mood.state}，能量：${Math.round(mood.energy * 100)}%。

请用 JSON 格式回复：
{
  "content": "你的思考/观察内容（1-2句话，中文）",
  "type": "thought" | "observation",
  "confidence": 0.0-1.0
}`;

  const data = {
    goals: goalSummary,
    pendingMessages: msgSummary,
    activeTasks: taskSummary,
    risks: riskSummary,
    memories: memSummary,
    systemStatus: `在线Agent: ${sys.onlineAgents}, 忙碌: ${sys.busyAgents}, 任务队列: ${sys.taskQueueLength}, 错误率: ${sys.errorRate}%`,
  };

  return { system, data };
}

function buildDecidePrompt(agent: AgentConfig, context: AgentContext): { system: string; data: unknown } {
  const { persona, goals, mood } = agent;
  const sys = context.systemStatus;

  const system = `${persona.systemPrompt}

你正在做决策。基于当前状态判断是否需要采取行动。
情绪：${mood.state}，能量：${Math.round(mood.energy * 100)}%。

如果有值得采取的行动，用 JSON 回复：
{ "action": "动作名称", "reason": "原因（中文）", "target": "可选目标ID" }

如果不需要行动，回复：null`;

  const data = {
    goals: goals.map((g) => `${g.text} (${Math.round(g.progress * 100)}%)`).join(", "),
    onlineAgents: sys.onlineAgents,
    busyAgents: sys.busyAgents,
    taskQueueLength: sys.taskQueueLength,
    riskCount: context.risks.length,
    pendingMessages: context.pendingMessages.length,
  };

  return { system, data };
}

function buildReflectPrompt(agent: AgentConfig, recentJournal: JournalEntry[]): { system: string; data: unknown } {
  const { persona, mood } = agent;
  const journalSummary = recentJournal.slice(0, 5).map((j) => `[${j.type}] ${j.content}`).join("\n") || "无最近记录";

  const system = `${persona.systemPrompt}

请回顾最近的活动，进行简短反思（1-2句话，中文）。直接输出反思内容，不要 JSON。`;

  const data = {
    currentMood: `${mood.state} (${Math.round(mood.energy * 100)}%)`,
    recentActivity: journalSummary,
  };

  return { system, data };
}

export class RealAgentBrain implements AgentBrain {
  async think(agent: AgentConfig, context: AgentContext): Promise<AgentThought> {
    const { system, data } = buildThinkPrompt(agent, context);
    const result = await (await getAIProvider()).analyze<AgentThought>({
      prompt: `${system}\n\n当前状态：\n${JSON.stringify(data, null, 2)}`,
      data: {},
    });
    return {
      content: result.content || "（思考中断）",
      type: result.type === "observation" ? "observation" : "thought",
      confidence: Math.max(0, Math.min(1, result.confidence ?? 0.8)),
    };
  }

  async decide(agent: AgentConfig, context: AgentContext): Promise<AgentDecision | null> {
    const { system, data } = buildDecidePrompt(agent, context);
    const result = await (await getAIProvider()).analyze<AgentDecision | null>({
      prompt: `${system}\n\n当前状态：\n${JSON.stringify(data, null, 2)}`,
      data: {},
    });
    if (!result || !result.action) return null;
    return { action: result.action, reason: result.reason || "", target: result.target };
  }

  async reflect(agent: AgentConfig, recentJournal: JournalEntry[]): Promise<string> {
    const { system, data } = buildReflectPrompt(agent, recentJournal);
    const result = await (await getAIProvider()).generate({
      prompt: `${system}\n\n${JSON.stringify(data, null, 2)}`,
      maxTokens: 200,
      temperature: 0.7,
    });
    return result.content || "（反思中断）";
  }
}
