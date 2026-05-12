import { backendGet } from "@/lib/backend-client";
import { DashboardTrends } from "../dashboard-trends";

export async function TrendsIsland() {
  const res = await backendGet("/api/dashboard");
  const trends = res.data.trends;
  return <DashboardTrends trends={trends} />;
}
