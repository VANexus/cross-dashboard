/**
 * Agent 命令总线（client-only）
 * 任何 UI 按钮都能通过 sendAgentCommand(prompt) 把任务交棒给主 Agent（web 对话内核）：
 * AgentDrawer 监听 flowmind:agent-command 事件 → 打开抽屉 → 把 prompt 送入对话 →
 * Agent 编排能力执行，并把决策点（L2 确认门 / 渲染组件 / 页面导航）交回人。
 * 这是「UI 被 Agent 编排进与人交互」的桥：人不离开现有页面，Agent 只负责编排。
 */
export const AGENT_COMMAND_EVENT = "flowmind:agent-command";

export interface AgentCommand {
  prompt: string;
  /** 可选：锚定某个 Agent（如 /agents/[id] 页） */
  agentId?: string;
}

export function sendAgentCommand(prompt: string, agentId?: string): boolean {
  if (typeof window === "undefined") return false;
  window.dispatchEvent(
    new CustomEvent<AgentCommand>(AGENT_COMMAND_EVENT, {
      detail: { prompt, agentId },
    }),
  );
  return true;
}

/** 监听命令（返回取消函数）。供 AgentDrawer 使用。 */
export function subscribeAgentCommand(handler: (cmd: AgentCommand) => void): () => void {
  const listener = (ev: Event) => {
    const cmd = (ev as CustomEvent<AgentCommand>).detail;
    if (cmd && typeof cmd.prompt === "string") handler(cmd);
  };
  window.addEventListener(AGENT_COMMAND_EVENT, listener);
  return () => window.removeEventListener(AGENT_COMMAND_EVENT, listener);
}
