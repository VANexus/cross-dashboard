import { NextRequest } from "next/server";
import { success, notFound, badRequest, methodNotAllowed } from "@/lib/api-response";
import { updateAdKeywordSchema } from "@/lib/api-validation";
import { updateAdKeyword } from "@/lib/workflow-data-store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateAdKeywordSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid update data", parsed.error.flatten());
  const kw = updateAdKeyword(id, parsed.data);
  if (!kw) return notFound("Ad keyword");
  return success(kw);
}

export async function GET() {
  return methodNotAllowed();
}
