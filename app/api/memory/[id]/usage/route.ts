import { NextRequest } from "next/server";
import { success, notFound, methodNotAllowed } from "@/lib/api-response";
import { getMemoryById, getMemoryUsage } from "@/lib/mock-data-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entry = getMemoryById(id);
  if (!entry) return notFound("Memory entry");
  const usage = getMemoryUsage(id);
  return success({ memoryId: id, ...usage });
}

export async function POST() {
  return methodNotAllowed();
}
