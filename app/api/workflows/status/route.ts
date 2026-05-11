import { success, methodNotAllowed } from "@/lib/api-response";
import { getWorkflowStatuses } from "@/lib/workflow-data-store";

export async function GET() {
  return success(getWorkflowStatuses());
}

export async function POST() {
  return methodNotAllowed();
}
