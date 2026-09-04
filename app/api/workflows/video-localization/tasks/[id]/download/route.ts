import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { LocalizeService } from "@/lib/server/services";

const service = new LocalizeService();

export const GET = withDb(async (request: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const file = searchParams.get("file");
  if (!file) return badRequest("Missing file query parameter");
  // 防 path 越界：只允许安全的文件名（字母数字 / . - _ 空格）
  if (!/^[A-Za-z0-9._\- ]+$/.test(file)) {
    return badRequest("Invalid file name");
  }
  const url = await service.getDownloadUrl(id, file);
  return success({ url });
});

export { methodNotAllowed as POST };