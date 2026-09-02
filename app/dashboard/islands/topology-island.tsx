import { Bot } from "lucide-react";
import { getAgentsShared } from "@/lib/repositories/agent.repository";
import { getDbAsync } from "@/lib/db";
import { AgentTopologyClient } from "@/components/ui/agent-topology-client";

/** 仪表盘「Agent 协同拓扑」：三.js 3D 网络，节点色 = Agent 状态 */
export async function TopologyIsland() {
  await getDbAsync();
  const agents = (await getAgentsShared()).map((a) => ({ id: a.id, name: a.name, status: a.status }));

  return (
    <div className="glass dash-panel">
      <div className="dash-panel-head">
        <span className="dash-panel-title">
          <Bot className="h-4 w-4" /> Agent 协同拓扑
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">拖拽旋转 · 悬停查看</span>
      </div>
      <AgentTopologyClient agents={agents} />
    </div>
  );
}
