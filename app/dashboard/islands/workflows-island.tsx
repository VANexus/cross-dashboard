import { backendGet } from "@/lib/backend-client";
import { DashboardWorkflows } from "../dashboard-workflows";
import type { WorkflowStatus } from "@/lib/types";

export async function WorkflowsIsland() {
  const res = await backendGet("/api/workflows/status");
  const workflows: WorkflowStatus[] = res.data ?? [];
  return <DashboardWorkflows workflows={workflows} />;
}
