import { DashboardWorkflows } from "../dashboard-workflows";
import { getDashboardDataShared } from "@/lib/services/dashboard.service";
import { getDbAsync } from "@/lib/db";
import type { WorkflowStatus } from "@/lib/types";

export async function WorkflowsIsland() {
  await getDbAsync();
  const dashboard = await getDashboardDataShared();
  const workflows: WorkflowStatus[] = dashboard.workflows ?? [];
  return <DashboardWorkflows workflows={workflows} />;
}
