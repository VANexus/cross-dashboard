import { success, methodNotAllowed } from "@/lib/api-response";
import { getCategoryRecs } from "@/lib/workflow-data-store";

export async function GET() {
  return success(getCategoryRecs());
}

export async function POST() {
  return methodNotAllowed();
}
