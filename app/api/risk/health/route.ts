import { success, methodNotAllowed } from "@/lib/api-response";
import { getHealthData } from "@/lib/mock-data-store";

export async function GET() {
  const data = getHealthData();
  return success(data);
}

export async function POST() {
  return methodNotAllowed();
}
