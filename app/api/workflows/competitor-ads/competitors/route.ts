import { success, methodNotAllowed } from "@/lib/api-response";
import { getCompetitors } from "@/lib/workflow-data-store";

export async function GET() {
  return success(getCompetitors());
}

export async function POST() {
  return methodNotAllowed();
}
