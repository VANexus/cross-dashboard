import { backendGet } from "@/lib/backend-client";
import { DashboardAlerts } from "../dashboard-alerts";
import type { Alert } from "@/lib/types";

export async function AlertsIsland() {
  const res = await backendGet("/api/dashboard");
  const alerts: Alert[] = res.data.alerts ?? [];
  return <DashboardAlerts alerts={alerts} />;
}
