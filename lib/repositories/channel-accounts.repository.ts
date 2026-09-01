/**
 * FlowMind RAK — 渠道账号保险库 Repository
 *
 * channel_accounts 表：多平台多账号登录会话（AES-256-GCM 密文）托管。
 * 明文会话只在服务端内存中出现（decryptSession），绝不随列表/详情返回前端。
 */
import { getSupabase } from "../db";
import { decryptSecret } from "../vault";
import type { ChannelAccount, ChannelAccountStatus, ChannelPlatform } from "../types";

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
  const sb = getSupabase();
  let q = sb.from("channel_accounts").select("*").order("created_at", { ascending: false });
  if (platform) q = q.eq("platform", platform);
  const { data, error } = await q;
  if (error) throw new Error(`读取渠道账号失败：${error.message}`);
  return ((data ?? []) as ChannelAccountRow[]).map(toAccount);
}

export async function getChannelAccount(id: string): Promise<ChannelAccount | null> {
  const sb = getSupabase();
  const { data } = await sb.from("channel_accounts").select("*").eq("id", id).maybeSingle();
  return data ? toAccount(data as ChannelAccountRow) : null;
}

export async function insertChannelAccount(a: {
  platform: ChannelPlatform;
  label: string;
  sessionEnc: string;
}): Promise<ChannelAccount> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("channel_accounts")
    .insert({ platform: a.platform, label: a.label, session_enc: a.sessionEnc, status: "active" })
    .select("*")
    .single();
  if (error) throw new Error(`写入渠道账号失败：${error.message}`);
  return toAccount(data as ChannelAccountRow);
}

export async function updateChannelAccount(
  id: string,
  patch: { label?: string; sessionEnc?: string; status?: ChannelAccountStatus; lastCheckedAt?: string },
): Promise<void> {
  const sb = getSupabase();
  const row: Record<string, unknown> = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.sessionEnc !== undefined) row.session_enc = patch.sessionEnc;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.lastCheckedAt !== undefined) row.last_checked_at = patch.lastCheckedAt;
  if (Object.keys(row).length === 0) return;
  const { error } = await sb.from("channel_accounts").update(row).eq("id", id);
  if (error) throw new Error(`更新渠道账号失败：${error.message}`);
}

export async function deleteChannelAccount(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("channel_accounts").delete().eq("id", id);
  if (error) throw new Error(`删除渠道账号失败：${error.message}`);
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
