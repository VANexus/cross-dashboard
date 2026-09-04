import { DashboardTrends } from "../dashboard-trends";
import { getDashboardDataShared } from "@/lib/server/services/dashboard.service";
import { getDbAsync } from "@/lib/server/db";

export async function TrendsIsland() {
  await getDbAsync();
  const dashboard = await getDashboardDataShared();
  return <DashboardTrends trends={dashboard.trends ?? { sales: [], acos: [], conversion: [] }} />;
}
