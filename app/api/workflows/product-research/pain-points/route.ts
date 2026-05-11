import { success, methodNotAllowed } from "@/lib/api-response";
import { getPainPoints } from "@/lib/workflow-data-store";

export async function GET() {
  return success(getPainPoints());
}

export async function POST() {
  return methodNotAllowed();
}
