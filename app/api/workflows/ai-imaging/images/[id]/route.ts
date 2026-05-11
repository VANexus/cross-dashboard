import { NextRequest } from "next/server";
import { success, notFound, badRequest, methodNotAllowed } from "@/lib/api-response";
import { updateImageSchema } from "@/lib/api-validation";
import { updateImage } from "@/lib/workflow-data-store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateImageSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid update data", parsed.error.flatten());
  const img = updateImage(id, parsed.data);
  if (!img) return notFound("Image");
  return success(img);
}

export async function GET() {
  return methodNotAllowed();
}
