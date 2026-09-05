import type { NextRequest } from "next/server";
import { notFound } from "@/lib/server/api-response";

/**
 * 广告导出文件下载（真实 CSV 落 data/exports 后经此返回）。
 * 路径安全：仅允许 data/exports 目录下文件名（path.basename 防目录穿越）。
 */
export async function GET(request: NextRequest) {
  const file = request.nextUrl.searchParams.get("file") ?? "";
  const safe = file.replace(/[\\/]/g, ""); // 剥掉任何路径分隔符，仅保留文件名
  if (!safe || !safe.endsWith(".csv")) return notFound("文件不存在");

  const path = (await import("node:path")).default;
  const fs = (await import("node:fs/promises")).default;
  const target = path.join(process.cwd(), "data", "exports", safe);

  try {
    await fs.access(target);
  } catch {
    return notFound("文件不存在或已清理");
  }
  const buf = await fs.readFile(target);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safe}"`,
      "Cache-Control": "no-store",
    },
  });
}