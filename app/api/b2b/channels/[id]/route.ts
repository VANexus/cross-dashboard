import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, methodNotAllowed, notFound } from "@/lib/api-response";
import { parseBody, b2bChannelUpdateSchema } from "@/lib/api-validation";
import { deleteChannelAccount, updateChannelAccount } from "@/lib/repositories/channel-accounts.repository";
import { encryptSecret } from "@/lib/vault";

/** 渠道账号更新（label / session 换绑 / status）与删除。 */
export const PATCH = withDb(async (request: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const parsed = parseBody(b2bChannelUpdateSchema, await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const { session, ...rest } = parsed.data;
  try {
    await updateChannelAccount(id, {
      ...rest,
      ...(session !== undefined ? { sessionEnc: encryptSecret(session) } : {}),
    });
    return success({ id, ok: true });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "更新失败");
  }
});

export const DELETE = withDb(async (_request: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  try {
    await deleteChannelAccount(id);
    return success({ id, ok: true });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "删除失败");
  }
});

export const GET = () => notFound("账号");
export { methodNotAllowed as POST };
