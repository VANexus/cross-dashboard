import { success, methodNotAllowed } from "@/lib/api-response";
import { getDataSources } from "@/lib/workflow-data-store";

export async function GET() {
  return success(getDataSources());
}

export async function POST() {
  return methodNotAllowed();
}
