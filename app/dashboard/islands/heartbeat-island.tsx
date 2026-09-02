import { getAgentsShared } from "@/lib/repositories/agent.repository";
import { getDbAsync } from "@/lib/db";
import { DashboardHeartbeat } from "../dashboard-heartbeat";

export async function HeartbeatIsland() {
  await getDbAsync();
  const agents = await getAgentsShared();
  return <DashboardHeartbeat agents={agents} />;
}
