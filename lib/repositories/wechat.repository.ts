/**
 * FlowMind — 微信公众号端到端发布 Repository
 *
 * wf_wechat_accounts：公众号账号保险库（AppID/AppSecret AES-256-GCM 密文）。
 * wf_wechat_publish_jobs：发布任务（分步人工确认状态机）。
 *
 * 安全约定：明文凭证只在服务端内存出现（创建 / 测试 / 发布时解密），
 * 列表与详情一律返回 appIdMasked，绝不把密文/明文回传前端。
 */
import { getSupabase } from "../db";
import { encryptSecret, decryptSecret } from "../vault";
import type {
  WechatAccount, WechatChannel, WechatPublishJob, WechatPublishStatus, WechatPublishStep,
} from "../types";
import { parseJsonField } from "./base";

// ── wf_wechat_accounts ───────────────────────────────────────────────

interface AccountRow {
  id: string;
  label: string;
  app_id_enc: string;
  app_secret_enc: string;
  is_default: boolean;
  status: string;
  last_checked_at: string | null;
  created_at: string;
}

function maskAppId(appId: string): string {
  if (!appId) return "";
  if (appId.length <= 10) return appId.slice(0, 2) + "****";
  return `${appId.slice(0, 6)}****${appId.slice(-4)}`;
}

function rowToAccount(r: AccountRow): WechatAccount {
  let appIdMasked = "";
  try {
    appIdMasked = maskAppId(decryptSecret(r.app_id_enc));
  } catch {
    appIdMasked = "****（解密失败）";
  }
  return {
    id: r.id,
    label: r.label,
    appIdMasked,
    isDefault: !!r.is_default,
    status: (r.status === "invalid" ? "invalid" : "active") as WechatAccount["status"],
    lastCheckedAt: r.last_checked_at,
    createdAt: r.created_at,
  };
}

export async function listWechatAccounts(): Promise<WechatAccount[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("wf_wechat_accounts")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`读取公众号账号失败：${error.message}`);
  return ((data ?? []) as AccountRow[]).map(rowToAccount);
}

/** 服务端专用：返回含密文的账号（供发布/测试时解密）。调用方不得回传前端。 */
export async function getWechatAccountSecret(id: string): Promise<{
  id: string; label: string; appId: string; appSecret: string;
} | null> {
  const sb = getSupabase();
  const { data, error } = await sb.from("wf_wechat_accounts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`读取公众号账号失败：${error.message}`);
  const row = data as AccountRow | null;
  if (!row) return null;
  try {
    return {
      id: row.id,
      label: row.label,
      appId: decryptSecret(row.app_id_enc),
      appSecret: decryptSecret(row.app_secret_enc),
    };
  } catch {
    return null;
  }
}

export async function createWechatAccount(input: {
  label: string; appId: string; appSecret: string;
}): Promise<WechatAccount> {
  const sb = getSupabase();
  const { data: existing } = await sb.from("wf_wechat_accounts").select("id").limit(1);
  const isFirst = !existing || existing.length === 0;

  const row = {
    label: input.label || "未命名公众号",
    app_id_enc: encryptSecret(input.appId),
    app_secret_enc: encryptSecret(input.appSecret),
    is_default: isFirst,
    status: "active",
  };
  const { data, error } = await sb.from("wf_wechat_accounts").insert(row).select("*").single();
  if (error) throw new Error(`写入公众号账号失败：${error.message}`);
  return rowToAccount(data as AccountRow);
}

export async function updateWechatAccount(
  id: string,
  patch: {
    label?: string; appId?: string; appSecret?: string;
    status?: WechatAccount["status"]; lastCheckedAt?: string; isDefault?: boolean;
  },
): Promise<void> {
  const sb = getSupabase();
  const row: Record<string, unknown> = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.appId !== undefined) row.app_id_enc = encryptSecret(patch.appId);
  if (patch.appSecret !== undefined) row.app_secret_enc = encryptSecret(patch.appSecret);
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.lastCheckedAt !== undefined) row.last_checked_at = patch.lastCheckedAt;
  if (patch.isDefault !== undefined) row.is_default = patch.isDefault;
  if (Object.keys(row).length === 0) return;
  const { error } = await sb.from("wf_wechat_accounts").update(row).eq("id", id);
  if (error) throw new Error(`更新公众号账号失败：${error.message}`);
}

export async function setDefaultWechatAccount(id: string): Promise<void> {
  const sb = getSupabase();
  const { error: e1 } = await sb.from("wf_wechat_accounts").update({ is_default: false }).neq("id", id);
  if (e1) throw new Error(`更新公众号账号失败：${e1.message}`);
  const { error: e2 } = await sb.from("wf_wechat_accounts").update({ is_default: true }).eq("id", id);
  if (e2) throw new Error(`更新公众号账号失败：${e2.message}`);
}

export async function deleteWechatAccount(id: string): Promise<boolean> {
  const sb = getSupabase();
  const { data: before } = await sb.from("wf_wechat_accounts").select("id").eq("id", id).maybeSingle();
  if (!before) return false;
  const { error } = await sb.from("wf_wechat_accounts").delete().eq("id", id);
  if (error) throw new Error(`删除公众号账号失败：${error.message}`);
  return true;
}

// ── wf_wechat_publish_jobs ───────────────────────────────────────────

interface JobRow {
  id: string;
  account_id: string | null;
  title: string;
  summary: string;
  author: string;
  body_html: string;
  thumb_url: string;
  channel: string;
  theme: string;
  publish_time: number | null;
  status: string;
  step: string;
  media_id: string;
  publish_id: string | null;
  msg_id: string | null;
  article_url: string | null;
  warning: string;
  steps_json: string;
  created_at: string;
  updated_at: string;
}

function rowToJob(r: JobRow): WechatPublishJob {
  return {
    id: r.id,
    accountId: r.account_id,
    title: r.title,
    summary: r.summary,
    author: r.author,
    bodyHtml: r.body_html,
    thumbUrl: r.thumb_url,
    channel: (r.channel === "mass" ? "mass" : "publish") as WechatChannel,
    theme: r.theme,
    publishTime: r.publish_time,
    status: r.status as WechatPublishStatus,
    step: r.step as WechatPublishStep,
    mediaId: r.media_id,
    publishId: r.publish_id,
    msgId: r.msg_id,
    articleUrl: r.article_url,
    warning: r.warning,
    steps: parseJsonField<string[]>(r.steps_json, []),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface CreateJobInput {
  title: string;
  bodyHtml: string;
  accountId?: string | null;
  summary?: string;
  author?: string;
  thumbUrl?: string;
  channel?: WechatChannel;
  theme?: string;
  publishTime?: number | null;
}

export async function createWechatJob(input: CreateJobInput): Promise<WechatPublishJob> {
  const sb = getSupabase();
  const row = {
    account_id: input.accountId ?? null,
    title: input.title,
    summary: input.summary ?? "",
    author: input.author ?? "",
    body_html: input.bodyHtml,
    thumb_url: input.thumbUrl ?? "",
    channel: input.channel ?? "publish",
    theme: input.theme ?? "default",
    publish_time: input.publishTime ?? null,
    status: "drafting",
    step: "typeset",
    steps_json: JSON.stringify(["job_created"]),
  };
  const { data, error } = await sb.from("wf_wechat_publish_jobs").insert(row).select("*").single();
  if (error) throw new Error(`创建发布任务失败：${error.message}`);
  return rowToJob(data as JobRow);
}

export async function getWechatJob(id: string): Promise<WechatPublishJob | null> {
  const sb = getSupabase();
  const { data, error } = await sb.from("wf_wechat_publish_jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`读取发布任务失败：${error.message}`);
  return data ? rowToJob(data as JobRow) : null;
}

export async function listWechatJobs(limit = 50): Promise<WechatPublishJob[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("wf_wechat_publish_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`读取发布历史失败：${error.message}`);
  return ((data ?? []) as JobRow[]).map(rowToJob);
}

export async function updateWechatJob(
  id: string,
  patch: {
    title?: string; summary?: string; author?: string; bodyHtml?: string; thumbUrl?: string;
    channel?: WechatChannel; theme?: string; publishTime?: number | null;
    accountId?: string | null; status?: WechatPublishStatus; step?: WechatPublishStep;
    mediaId?: string; publishId?: string | null; msgId?: string | null; articleUrl?: string | null;
    warning?: string; steps?: string[];
  },
): Promise<void> {
  const sb = getSupabase();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.summary !== undefined) row.summary = patch.summary;
  if (patch.author !== undefined) row.author = patch.author;
  if (patch.bodyHtml !== undefined) row.body_html = patch.bodyHtml;
  if (patch.thumbUrl !== undefined) row.thumb_url = patch.thumbUrl;
  if (patch.channel !== undefined) row.channel = patch.channel;
  if (patch.theme !== undefined) row.theme = patch.theme;
  if (patch.publishTime !== undefined) row.publish_time = patch.publishTime;
  if (patch.accountId !== undefined) row.account_id = patch.accountId;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.step !== undefined) row.step = patch.step;
  if (patch.mediaId !== undefined) row.media_id = patch.mediaId;
  if (patch.publishId !== undefined) row.publish_id = patch.publishId;
  if (patch.msgId !== undefined) row.msg_id = patch.msgId;
  if (patch.articleUrl !== undefined) row.article_url = patch.articleUrl;
  if (patch.warning !== undefined) row.warning = patch.warning;
  if (patch.steps !== undefined) row.steps_json = JSON.stringify(patch.steps);
  if (Object.keys(row).length === 1) return;
  const { error } = await sb.from("wf_wechat_publish_jobs").update(row).eq("id", id);
  if (error) throw new Error(`更新发布任务失败：${error.message}`);
}

export async function deleteWechatJob(id: string): Promise<boolean> {
  const sb = getSupabase();
  const { data: before } = await sb.from("wf_wechat_publish_jobs").select("id").eq("id", id).maybeSingle();
  if (!before) return false;
  const { error } = await sb.from("wf_wechat_publish_jobs").delete().eq("id", id);
  if (error) throw new Error(`删除发布任务失败：${error.message}`);
  return true;
}
