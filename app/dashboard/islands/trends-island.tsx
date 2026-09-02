import { DashboardTrends } from "../dashboard-trends";
import { getDashboardDataShared } from "@/lib/services/dashboard.service";
import { getDbAsync } from "@/lib/db";

export async function TrendsIsland() {
  await getDbAsync();
  const dashboard = await getDashboardDataShared();
  return <DashboardTrends trends={dashboard.trends ?? { sales: [], acos: [], conversion: [] }} />;
}
