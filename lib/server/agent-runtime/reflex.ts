/**
 * FlowMind RAK — Reflex Layer（确定性反射，非 LLM 替代品）
 *
 * 架构定位：Agent 认知分两层 —— 反射（reflex，确定性、数据驱动、零延迟）
 * 与深思（deliberation，LLM 生成）。LLM 未配置（AIConfigError）或波动时，
 * 运行时降级为反射，产出的观察/决策/反思全部来自真实系统状态（任务、风险、
 * 消息、记忆、指标），绝无假数据。LLM 可用时仍优先走大脑。
 */
import type { AgentConfig, JournalEntry } from "@/lib/shared/types";
import type { AgentContext, AgentThought, AgentDecision } from "./brain";

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function reflexThink(agent: AgentConfig, name: string, context: AgentContext): AgentThought {
  const sys = context.systemStatus;
  const parts: string[] = [];
  if (context.activeTasks.length > 0) {
    parts.push(`活跃任务 ${context.activeTasks.length} 项（${context.activeTasks.map((t) => t.title).slice(0, 2).join("、")}）`);
  }
  if (context.risks.length > 0) {
    parts.push(`未解决风险 ${context.risks.length} 项（最高 ${context.risks[0].level}）`);
  }
  if (context.pendingMessages.length > 0) {
    parts.push(`待处理消息 ${context.pendingMessages.length} 条`);
  }
  if (context.memories.length > 0) {
    parts.push(`已召回记忆 ${context.memories.length} 条`);
  }
  if (parts.length === 0) {
    parts.push(`系统稳态：在线 ${sys.onlineAgents} / 忙碌 ${sys.busyAgents} / 队列 ${sys.taskQueueLength} / 错误率 ${sys.errorRate}%`);
  }
  const content = `【反射】${name}：${parts.join("；")}。`;
  return {
    content,
    type: "observation",
    confidence: Math.min(0.9, 0.5 + context.activeTasks.length * 0.05 + context.risks.length * 0.05),
  };
}

export function reflexDecide(_agent: AgentConfig, context: AgentContext): AgentDecision | null {
  // 确定性规则：有未解决风险 → 升级；有待处理消息 → 转发给调度；否则不行动
  if (context.risks.length > 0) {
    return {
      action: "escalate_risk",
      reason: `反射规则：检测到 ${context.risks.length} 项未解决风险，最高级别 ${context.risks[0].level}，触发升级`,
      target: context.risks[0].id,
    };
  }
  if (context.pendingMessages.length > 0) {
    return {
      action: "send_alert",
      reason: `反射规则：有待处理消息 ${context.pendingMessages.length} 条，通知调度器协同`,
    };
  }
  return null;
}

export function reflexReflect(agent: AgentConfig, name: string, recentJournal: JournalEntry[]): string {
  const reflections = recentJournal.filter((j) => j.type === "reflection" || j.type === "observation").slice(0, 5);
  const summary = reflections.map((j) => j.content).join(" | ");
  const focus = agent.persona.expertise[0] ?? name;
  if (!summary) {
    return `当前无积累反思。领域「${focus}」尚待沉淀：建议保持关注目标推进并持续记录观察。`;
  }
  return `反射（数据驱动）：近期围绕「${focus}」的 ${reflections.length} 条观察/反思形成信号：${summary}。下一步应把高置信信号沉淀为可复用记忆。`;
}
