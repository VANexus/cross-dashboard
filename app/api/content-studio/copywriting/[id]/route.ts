import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, notFound, badRequest } from "@/lib/api-response";
import { parseBody, updateDraftSchema } from "@/lib/api-validation";
import { ContentService } from "@/lib/services";

const service = new ContentService();

export const PATCH = withDb(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const parsed = parseBody(updateDraftSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const draft = service.updateDraft(id, parsed.data);
  if (!draft) return notFound("草稿");
  return success(draft);
});

export const DELETE = withDb(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!service.removeDraft(id)) return notFound("草稿");
  return success({ deleted: true, id });
});
