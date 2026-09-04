import { DashboardAlerts } from "../dashboard-alerts";
import { getDashboardDataShared } from "@/lib/server/services/dashboard.service";
import { getDbAsync } from "@/lib/server/db";
import type { Alert } from "@/lib/shared/types";

export async function AlertsIsland() {
  await getDbAsync();
  const dashboard = await getDashboardDataShared();
  const alerts: Alert[] = dashboard.alerts ?? [];
  return <DashboardAlerts alerts={alerts} />;
}
