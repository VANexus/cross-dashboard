import { success, methodNotAllowed } from "@/lib/api-response";
import { getDashboardData } from "@/lib/mock-data-store";

export async function GET() {
  const data = getDashboardData();
  return success(data);
}

export async function POST() {
  return methodNotAllowed();
}
