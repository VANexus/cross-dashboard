import { NextRequest } from "next/server";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { createRestockOrderSchema } from "@/lib/api-validation";
import { createTask } from "@/lib/mock-data-store";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createRestockOrderSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid restock order", parsed.error.flatten());
  const skus = parsed.data.items.map((i) => i.sku).join(", ");
  const task = createTask({
    title: `补货单 — ${parsed.data.items.length} 个 SKU`,
    description: `SKU: ${skus}`,
    priority: "high",
    assignedAgents: ["ops-001"],
  });
  return success(task);
}

export async function GET() {
  return methodNotAllowed();
}
