import { success, methodNotAllowed } from "@/lib/api-response";
import { getStoryboardFrames } from "@/lib/workflow-data-store";

export async function GET() {
  return success(getStoryboardFrames());
}

export async function POST() {
  return methodNotAllowed();
}
