import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, error, methodNotAllowed, badRequest } from "@/lib/server/api-response";
import { s3Config } from "@/lib/cluster";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * 图片上传 → MinIO（集群 S3，P1 数据层）。
 * 凭据/端点经 lib/cluster 目录（S3_ACCESS_KEY/S3_SECRET_KEY/S3_ENDPOINT）；
 * 返回 7 天预签名 URL（dev 与集群同源可用，不依赖桶公开策略）。
 */

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

let _client: S3Client | null = null;
let _bucketReady: Promise<string> | null = null;

function client(): S3Client {
  if (!_client) {
    const c = s3Config();
    if (!c.accessKey || !c.secretKey) {
      throw new Error("MinIO 凭据缺失：设置 S3_ACCESS_KEY / S3_SECRET_KEY（集群由 Secret 注入）");
    }
    _client = new S3Client({
      endpoint: c.endpoint,
      region: "us-east-1",
      forcePathStyle: c.forcePathStyle,
      credentials: { accessKeyId: c.accessKey, secretAccessKey: c.secretKey },
    });
  }
  return _client;
}

/** 确保桶存在（幂等），返回桶名 */
function ensureBucket(): Promise<string> {
  if (!_bucketReady) {
    _bucketReady = (async () => {
      const c = s3Config();
      const s3 = client();
      try {
        await s3.send(new HeadBucketCommand({ Bucket: c.bucket }));
      } catch {
        await s3.send(new CreateBucketCommand({ Bucket: c.bucket }));
      }
      return c.bucket;
    })();
  }
  return _bucketReady;
}

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
  const key = `image-skills/uploads/${stamp}/${rand}.${safeExt}`;

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const bucket = await ensureBucket();
    const s3 = client();
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 7 * 24 * 3600 },
    );
    return success({ path: key, url, size: file.size, type: file.type });
  } catch (e) {
    return error(`上传失败：${e instanceof Error ? e.message : String(e)}`, 502);
  }
});

export { methodNotAllowed as GET };
export { methodNotAllowed as PATCH };
export { methodNotAllowed as DELETE };
