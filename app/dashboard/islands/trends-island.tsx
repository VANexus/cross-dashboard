import { DashboardTrends } from "../dashboard-trends";
import { DashboardService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";

export async function TrendsIsland() {
  await getDbAsync();
  const service = new DashboardService();
  const dashboard = await service.getDashboardData();
  return <DashboardTrends trends={dashboard.trends ?? { sales: [], acos: [], conversion: [] }} />;
}
