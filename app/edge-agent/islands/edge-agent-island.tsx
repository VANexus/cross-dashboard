/**
 * FlowMind — Edge Agent Island（SSR）
 *
 * 服务端组件，通过 A2AClient 获取 Agent Card 技能列表，
 * 作为 props 传递给客户端组件。遵循项目 Island/SSR 模式。
 */
import { A2AClient } from "@/lib/a2a/a2a-client";
import type { AgentSkill } from "@/lib/a2a/types";

export async function EdgeAgentIsland() {
  const client = new A2AClient();
  let skills: AgentSkill[] = [];
  let error: string | null = null;

  try {
    const card = await client.fetchAgentCard();
    skills = card.skills ?? [];
  } catch {
    // SSR 失败不阻塞页面，客户端会处理连接问题
    error = "无法连接到 flowmind A2A 服务";
  }

  return { skills, error };
}
