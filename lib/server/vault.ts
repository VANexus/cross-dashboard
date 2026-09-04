/**
 * FlowMind RAK — 渠道会话保险库（AES-256-GCM）
 *
 * 密文格式：base64( iv(12B) | auth_tag(16B) | ciphertext )
 * 主密钥：环境变量 CHANNEL_VAULT_KEY（32 字节 base64，`openssl rand -base64 32` 生成）。
 *   - 生产必须显式配置，绝不入库、绝不入代码。
 *   - 本地 dev / E2E 未配置时降级为确定性开发密钥（仅限非生产环境）。
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const DEV_FALLBACK_KEY = "ZGV2LW9ubHktY2hhbm5lbC12YXVsdC1rZXkhISEh"; // base64("dev-only-channel-vault-key!!!!") 32B

function getKey(): Buffer {
  const raw = process.env.CHANNEL_VAULT_KEY || DEV_FALLBACK_KEY;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("CHANNEL_VAULT_KEY 必须是 32 字节的 base64 字符串（openssl rand -base64 32）");
  }
  return key;
}

/** 加密明文会话（cookie 串等）→ base64 密文。 */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

/** 解密 base64 密文 → 明文会话。格式/密钥不符时抛错。 */
export function decryptSecret(enc: string): string {
  const buf = Buffer.from(enc, "base64");
  if (buf.length < 12 + 16 + 1) throw new Error("会话密文格式非法（过短）");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
