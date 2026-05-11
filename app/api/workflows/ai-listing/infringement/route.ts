import { success, methodNotAllowed } from "@/lib/api-response";
import { getInfringementWords } from "@/lib/workflow-data-store";

export async function GET() {
  return success(getInfringementWords());
}

export async function POST() {
  return methodNotAllowed();
}
