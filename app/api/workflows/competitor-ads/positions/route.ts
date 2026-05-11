import { success, methodNotAllowed } from "@/lib/api-response";
import { getAdPositions } from "@/lib/workflow-data-store";

export async function GET() {
  return success(getAdPositions());
}

export async function POST() {
  return methodNotAllowed();
}
