import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, error, methodNotAllowed, badRequest } from "@/lib/api-response";

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://xbdznkpdtlysvbcoptyw.supabase.co";

// Prefer service role if present — upload large files — but withDb req doesn't need db just storage
import { createClient } from "@supabase/supabase-js";

function storageClient() {
  const key = SERVICE_ROLE_KEY!;
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const BUCKET = "image-skills";
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

export const POST = withDb(async (request: NextRequest) => {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return badRequest("必须使用 multipart/form-data 上传图片");
  }
  const fd = await request.formData();
  const file = fd.get("file") as File | null;
  if (!file) return badRequest("缺少 file 字段");
  if (file.size > MAX_BYTES) return badRequest(`图片大小超过 ${(MAX_BYTES / 1024 / 1024) | 0}MB 上限`);
  if (!ALLOWED.includes(file.type)) return badRequest(`不支持的图片类型：${file.type}（仅支持 JPG/PNG/WEBP/AVIF/GIF）`);
  if (!file.name) return badRequest("文件名为空");

  const ext = (file.name.split(".").pop() ?? "").toLowerCase() || "bin";
  const safeExt = /^(jpe?g|png|webp|avif|gif)$/i.test(ext) ? ext : "bin";
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `uploads/${stamp}/${rand}.${safeExt}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sb = storageClient();

  const { data: uploadData, error: uploadErr } = await sb.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
      upsert: false,
    });

  if (uploadErr || !uploadData) {
    return error(`上传失败：${uploadErr?.message ?? "未知错误"}`, 502);
  }

  // Get public URL
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);

  return success({
    path: uploadData.path ?? path,
    url: pub.publicUrl,
    size: file.size,
    type: file.type,
  });
});

export { methodNotAllowed as GET };
export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
