"use client";

import { agents } from "@/lib/mock-data";
import { AgentCard } from "@/components/agents/agent-card";
import { Badge } from "@/components/ui/badge";

export default function AgentsPage() {
  const onlineCount = agents.filter((a) => a.status === "online").length;
  const busyCount = agents.filter((a) => a.status === "busy").length;
  const errorCount = agents.filter((a) => a.status === "error").length;
  const offlineCount = agents.filter((a) => a.status === "offline").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent 管理</h1>
          <p className="text-sm text-muted-foreground">
            监控和管理 FlowMind 系统中的所有智能体
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">{onlineCount} 在线</Badge>
          <Badge variant="warning">{busyCount} 忙碌</Badge>
          {errorCount > 0 && <Badge variant="danger">{errorCount} 异常</Badge>}
          <Badge variant="secondary">{offlineCount} 离线</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}
