import { DashboardWorkflows } from "../dashboard-workflows";
import { WorkflowService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";
import type { WorkflowStatus } from "@/lib/types";

export async function WorkflowsIsland() {
  await getDbAsync();
  const service = new WorkflowService();
  const workflows: WorkflowStatus[] = await service.getWorkflowStatuses();
  return <DashboardWorkflows workflows={workflows} />;
}
