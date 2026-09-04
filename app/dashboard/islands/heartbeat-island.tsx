import { DashboardHeartbeat } from "../dashboard-heartbeat";

/** Agent 心跳：真实活动数据（journal 分桶 + 心跳年龄），客户端 10s 自动刷新。 */
export async function HeartbeatIsland() {
  return <DashboardHeartbeat />;
}
