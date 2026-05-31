import { AgentService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";
import { DashboardHeartbeat } from "../dashboard-heartbeat";

const agentService = new AgentService();

export async function HeartbeatIsland() {
  await getDbAsync();
  const agents = agentService.list();
  return <DashboardHeartbeat agents={agents} />;
}
