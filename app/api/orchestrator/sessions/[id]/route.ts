import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, notFound, methodNotAllowed } from "@/lib/server/api-response";
import {
  getSession,
  updateSession,
  deleteSession,
  type StoredMessage,
} from "@/lib/server/orchestrator/session-store";

export const GET = withDb(async (_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return notFound("Session");
  return success(session);
});

export const PATCH = withDb(async (request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  let body: { messages?: StoredMessage[] };
  try {
    body = (await request.json()) as { messages?: StoredMessage[] };
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (!Array.isArray(body.messages)) {
    return badRequest("messages must be an array");
  }
  const session = await updateSession(id, body.messages);
  if (!session) return notFound("Session");
  return success(session);
});

export const DELETE = withDb(async (_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ok = await deleteSession(id);
  if (!ok) return notFound("Session");
  return success({ deleted: true });
});

export { methodNotAllowed as POST };
