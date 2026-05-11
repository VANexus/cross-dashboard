import { success, methodNotAllowed } from "@/lib/api-response";
import { getRestockSuggestions } from "@/lib/workflow-data-store";

export async function GET() {
  return success(getRestockSuggestions());
}

export async function POST() {
  return methodNotAllowed();
}
