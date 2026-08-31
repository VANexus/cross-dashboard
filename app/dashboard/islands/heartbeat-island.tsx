import { AgentService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";
import { DashboardHeartbeat } from "../dashboard-heartbeat";

export async function HeartbeatIsland() {
  await getDbAsync();
  const agentService = new AgentService();
  const agents = await agentService.list();
  return <DashboardHeartbeat agents={agents} />;
}
