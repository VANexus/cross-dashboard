/**
 * FlowMind RAK — 渠道账号保险库 Repository
 *
 * channel_accounts 表：多平台多账号登录会话（AES-256-GCM 密文）托管。
 * 明文会话只在服务端内存中出现（decryptSession），绝不随列表/详情返回前端。
 */
import { prisma, isoRow, isoRows } from "@/lib/server/db";
import { decryptSecret } from "../vault";
import type { ChannelAccount, ChannelAccountStatus, ChannelPlatform } from "@/lib/shared/types";

interface ChannelAccountRow {
  id: string;
  platform: ChannelPlatform;
  label: string;
  session_enc: string;
  status: ChannelAccountStatus;
  last_checked_at: string | null;
  created_at: string;
}

function toAccount(r: ChannelAccountRow): ChannelAccount {
  return {
    id: r.id,
    platform: r.platform,
    label: r.label,
    sessionEnc: r.session_enc,
    status: r.status,
    lastCheckedAt: r.last_checked_at,
    createdAt: r.created_at,
  };
}

export async function listChannelAccounts(platform?: ChannelPlatform): Promise<ChannelAccount[]> {
  try {
    const rows = await prisma.channel_accounts.findMany({
      where: platform ? { platform } : {},
      orderBy: { created_at: "desc" },
    });
    return isoRows(rows as unknown as Array<Record<string, unknown>>).map(
      (r) => toAccount(r as unknown as ChannelAccountRow),
    );
  } catch (e) {
    throw new Error(`读取渠道账号失败：${(e as Error).message}`);
  }
}

export async function getChannelAccount(id: string): Promise<ChannelAccount | null> {
  const row = await prisma.channel_accounts.findUnique({ where: { id } });
  if (!row) return null;
  return toAccount(isoRow(row as unknown as Record<string, unknown>) as unknown as ChannelAccountRow);
}

export async function insertChannelAccount(a: {
  platform: ChannelPlatform;
  label: string;
  sessionEnc: string;
}): Promise<ChannelAccount> {
  try {
    const row = await prisma.channel_accounts.create({
      data: { platform: a.platform, label: a.label, session_enc: a.sessionEnc, status: "active" },
    });
    return toAccount(isoRow(row as unknown as Record<string, unknown>) as unknown as ChannelAccountRow);
  } catch (e) {
    throw new Error(`写入渠道账号失败：${(e as Error).message}`);
  }
}

export async function updateChannelAccount(
  id: string,
  patch: { label?: string; sessionEnc?: string; status?: ChannelAccountStatus; lastCheckedAt?: string },
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (patch.label !== undefined) data.label = patch.label;
  if (patch.sessionEnc !== undefined) data.session_enc = patch.sessionEnc;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.lastCheckedAt !== undefined) data.last_checked_at = patch.lastCheckedAt;
  if (Object.keys(data).length === 0) return;
  try {
    await prisma.channel_accounts.update({ where: { id }, data });
  } catch (e) {
    // 记录不存在视为静默 no-op（对齐旧 update().eq() 语义）
    if ((e as { code?: string }).code === "P2025") return;
    throw new Error(`更新渠道账号失败：${(e as Error).message}`);
  }
}

export async function deleteChannelAccount(id: string): Promise<void> {
  try {
    await prisma.channel_accounts.delete({ where: { id } });
  } catch (e) {
    // 记录不存在视为幂等删除成功（对齐旧 delete().eq() 语义）
    if ((e as { code?: string }).code === "P2025") return;
    throw new Error(`删除渠道账号失败：${(e as Error).message}`);
  }
}

/** 服务端专用：解密指定账号会话明文。 */
export function decryptAccountSession(a: ChannelAccount): string {
  return decryptSecret(a.sessionEnc);
}

/**
 * 会话解析：取指定平台最新的 active 账号会话明文；无保险库账号/表未建/解密失败
 * 时返回 null（由调用方回退到 settings 单账号会话）——保险库故障绝不拖垮业务。
 */
export async function resolveChannelSession(platform: ChannelPlatform): Promise<string | null> {
  let accounts: ChannelAccount[];
  try {
    accounts = await listChannelAccounts(platform);
  } catch {
    return null;
  }
  const active = accounts.find((a) => a.status === "active");
  if (!active) return null;
  try {
    return decryptAccountSession(active);
  } catch {
    // 密钥轮换/密文损坏：标记过期，交由调用方回退
    await updateChannelAccount(active.id, { status: "expired", lastCheckedAt: new Date().toISOString() }).catch(() => {});
    return null;
  }
}
