import { Bot } from "lucide-react";
import { getAgentsShared } from "@/lib/server/repositories/agent.repository";
import { getAgentTeamMap } from "@/lib/server/repositories/team.repository";
import { getDbAsync } from "@/lib/server/db";
import { AgentTopologyClient } from "@/components/ui/agent-topology-client";

/** 仪表盘「Agent 协同拓扑」：三.js 3D 网络，节点色 = 状态，环色 = 团队，可拖拽旋转 */
export async function TopologyIsland() {
  await getDbAsync();
  const agents = (await getAgentsShared()).map((a) => ({ id: a.id, name: a.name, status: a.status, type: a.type }));
  const teamMapRaw = await getAgentTeamMap();
  const teamMap = Object.fromEntries(teamMapRaw);

  return (
    <div className="glass dash-panel dash-topology-stage" data-animate="panel" suppressHydrationWarning>
      <div className="dash-panel-head">
        <span className="dash-panel-title">
          <Bot className="h-4 w-4" /> Agent 协同拓扑
        </span>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <i className="h-1.5 w-1.5 rounded-full bg-success" />在线
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-1.5 w-1.5 rounded-full bg-warning" />忙碌
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-1.5 w-1.5 rounded-full bg-destructive" />异常
          </span>
        </div>
      </div>
      <AgentTopologyClient agents={agents} teamMap={teamMap} />
    </div>
  );
}
