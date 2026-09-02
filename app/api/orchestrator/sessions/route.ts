import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest } from "@/lib/api-response";
import {
  listSessions,
  createSession,
  type StoredMessage,
} from "@/lib/orchestrator/session-store";

export const GET = withDb(async () => {
  const sessions = await listSessions();
  return success(sessions);
});

export const POST = withDb(async (request: NextRequest) => {
  let body: { messages?: StoredMessage[] };
  try {
    body = (await request.json()) as { messages?: StoredMessage[] };
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (body.messages !== undefined && !Array.isArray(body.messages)) {
    return badRequest("messages must be an array");
  }
  const session = await createSession(body.messages ?? []);
  return success(session);
});
