/**
 * FlowMind — Edge Agent 客户端页面
 *
 * 渲染边缘智能体聊天面板。技能列表由 Island SSR 注入。
 */
"use client";

import { EdgeAgentPanel } from "@/components/edge-agent/EdgeAgentPanel";
import type { AgentSkill } from "@/lib/a2a/types";

interface EdgeAgentClientProps {
  skills: AgentSkill[];
  error: string | null;
}

export function EdgeAgentClient({ skills, error }: EdgeAgentClientProps) {
  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col gap-4 p-4 md:p-6">
      {error && (
        <div className="rounded-lg bg-yellow-500/10 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400">
          ⚠️ {error} — 客户端将尝试重新连接
        </div>
      )}
      <div className="flex-1">
        <EdgeAgentPanel initialSkills={skills} />
      </div>
    </div>
  );
}
