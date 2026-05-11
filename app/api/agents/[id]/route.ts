import { NextRequest } from "next/server";
import { success, notFound, methodNotAllowed } from "@/lib/api-response";
import { getAgentById } from "@/lib/mock-data-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agent = getAgentById(id);
  if (!agent) return notFound("Agent");
  return success(agent);
}

export async function POST() {
  return methodNotAllowed();
}
