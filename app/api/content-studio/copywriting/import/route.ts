import type { NextRequest } from "next/server";
import { z } from "zod";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { insertDraft, getDraft } from "@/lib/repositories/content.repository";
import { isPlatform } from "@/lib/content/platforms";

const importDraftSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
  platform: z.string().default("xhs"),
  tags: z.array(z.string()).max(10).default([]),
});

/** POST /api/content-studio/copywriting/import — 把编排产物直接存为内容库草稿（不调 MCP） */
export const POST = withDb(async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = importDraftSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "参数错误");
  const { title, body: content, platform, tags } = parsed.data;
  if (!isPlatform(platform)) return badRequest(`不支持的平台：${platform}`);

  const id = `draft-orch-${Date.now()}`;
  await insertDraft({ id, platform, title, body: content, tags });
  const draft = await getDraft(id);
  return success(draft);
});

export { methodNotAllowed as GET };
export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
