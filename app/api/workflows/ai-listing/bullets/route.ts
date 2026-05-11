import { success, methodNotAllowed } from "@/lib/api-response";
import { getBulletPoints } from "@/lib/workflow-data-store";

export async function GET() {
  return success(getBulletPoints());
}

export async function POST() {
  return methodNotAllowed();
}
