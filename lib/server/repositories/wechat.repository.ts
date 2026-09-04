/**
 * FlowMind — 微信公众号端到端发布 Repository
 *
 * wf_wechat_accounts：公众号账号保险库（AppID/AppSecret AES-256-GCM 密文）。
 * wf_wechat_publish_jobs：发布任务（分步人工确认状态机）。
 *
 * 安全约定：明文凭证只在服务端内存出现（创建 / 测试 / 发布时解密），
 * 列表与详情一律返回 appIdMasked，绝不把密文/明文回传前端。
 *
 * Prisma Client 版：两表均含真 DateTime 列，读出一律经 iso() 归一为 ISO 字符串；
 * publish_time 为 BigInt 列，写入转 BigInt、读出转 number，保持旧语义。
 */
import { Prisma } from "@prisma/client";
import { prisma, iso } from "@/lib/server/db";
import { encryptSecret, decryptSecret } from "../vault";
import type {
  WechatAccount, WechatChannel, WechatPublishJob, WechatPublishStatus, WechatPublishStep,
} from "@/lib/shared/types";
import { parseJsonField } from "./base";

// ── wf_wechat_accounts ───────────────────────────────────────────────

interface AccountRow {
  id: string;
  label: string;
  app_id_enc: string;
  app_secret_enc: string;
  is_default: boolean;
  status: string;
  last_checked_at: Date | string | null;
  created_at: Date | string;
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
    lastCheckedAt: iso(r.last_checked_at),
    createdAt: iso(r.created_at) ?? "",
  };
}

export async function listWechatAccounts(): Promise<WechatAccount[]> {
  try {
    const rows = await prisma.wf_wechat_accounts.findMany({
      orderBy: { created_at: "asc" },
    });
    return (rows as AccountRow[]).map(rowToAccount);
  } catch (e) {
    throw new Error(`读取公众号账号失败：${(e as Error).message}`);
  }
}

/** 服务端专用：返回含密文的账号（供发布/测试时解密）。调用方不得回传前端。 */
export async function getWechatAccountSecret(id: string): Promise<{
  id: string; label: string; appId: string; appSecret: string;
} | null> {
  let row: AccountRow | null;
  try {
    row = await prisma.wf_wechat_accounts.findUnique({ where: { id } });
  } catch (e) {
    throw new Error(`读取公众号账号失败：${(e as Error).message}`);
  }
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
  let existing: { id: string } | null;
  try {
    existing = await prisma.wf_wechat_accounts.findFirst({ select: { id: true } });
  } catch (e) {
    throw new Error(`读取公众号账号失败：${(e as Error).message}`);
  }
  const isFirst = existing === null;

  try {
    const row = await prisma.wf_wechat_accounts.create({
      data: {
        label: input.label || "未命名公众号",
        app_id_enc: encryptSecret(input.appId),
        app_secret_enc: encryptSecret(input.appSecret),
        is_default: isFirst,
        status: "active",
      },
    });
    return rowToAccount(row as AccountRow);
  } catch (e) {
    throw new Error(`写入公众号账号失败：${(e as Error).message}`);
  }
}

export async function updateWechatAccount(
  id: string,
  patch: {
    label?: string; appId?: string; appSecret?: string;
    status?: WechatAccount["status"]; lastCheckedAt?: string; isDefault?: boolean;
  },
): Promise<void> {
  const row: Prisma.wf_wechat_accountsUpdateInput = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.appId !== undefined) row.app_id_enc = encryptSecret(patch.appId);
  if (patch.appSecret !== undefined) row.app_secret_enc = encryptSecret(patch.appSecret);
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.lastCheckedAt !== undefined) row.last_checked_at = patch.lastCheckedAt;
  if (patch.isDefault !== undefined) row.is_default = patch.isDefault;
  if (Object.keys(row).length === 0) return;
  try {
    await prisma.wf_wechat_accounts.update({ where: { id }, data: row });
  } catch (e) {
    throw new Error(`更新公众号账号失败：${(e as Error).message}`);
  }
}

export async function setDefaultWechatAccount(id: string): Promise<void> {
  try {
    await prisma.wf_wechat_accounts.updateMany({
      where: { id: { not: id } },
      data: { is_default: false },
    });
    await prisma.wf_wechat_accounts.updateMany({
      where: { id },
      data: { is_default: true },
    });
  } catch (e) {
    throw new Error(`更新公众号账号失败：${(e as Error).message}`);
  }
}

export async function deleteWechatAccount(id: string): Promise<boolean> {
  let before: { id: string } | null;
  try {
    before = await prisma.wf_wechat_accounts.findUnique({ where: { id }, select: { id: true } });
  } catch {
    return false;
  }
  if (!before) return false;
  try {
    await prisma.wf_wechat_accounts.delete({ where: { id } });
  } catch (e) {
    throw new Error(`删除公众号账号失败：${(e as Error).message}`);
  }
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
  publish_time: bigint | number | null;
  status: string;
  step: string;
  media_id: string;
  publish_id: string | null;
  msg_id: string | null;
  article_url: string | null;
  warning: string;
  steps_json: string;
  created_at: Date | string;
  updated_at: Date | string;
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
    publishTime: r.publish_time != null ? Number(r.publish_time) : null,
    status: r.status as WechatPublishStatus,
    step: r.step as WechatPublishStep,
    mediaId: r.media_id,
    publishId: r.publish_id,
    msgId: r.msg_id,
    articleUrl: r.article_url,
    warning: r.warning,
    steps: parseJsonField<string[]>(r.steps_json, []),
    createdAt: iso(r.created_at) ?? "",
    updatedAt: iso(r.updated_at) ?? "",
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
  try {
    const row = await prisma.wf_wechat_publish_jobs.create({
      data: {
        account_id: input.accountId ?? null,
        title: input.title,
        summary: input.summary ?? "",
        author: input.author ?? "",
        body_html: input.bodyHtml,
        thumb_url: input.thumbUrl ?? "",
        channel: input.channel ?? "publish",
        theme: input.theme ?? "default",
        publish_time: input.publishTime != null ? BigInt(input.publishTime) : null,
        status: "drafting",
        step: "typeset",
        steps_json: JSON.stringify(["job_created"]),
      },
    });
    return rowToJob(row as JobRow);
  } catch (e) {
    throw new Error(`创建发布任务失败：${(e as Error).message}`);
  }
}

export async function getWechatJob(id: string): Promise<WechatPublishJob | null> {
  let row: JobRow | null;
  try {
    row = await prisma.wf_wechat_publish_jobs.findUnique({ where: { id } });
  } catch (e) {
    throw new Error(`读取发布任务失败：${(e as Error).message}`);
  }
  return row ? rowToJob(row) : null;
}

export async function listWechatJobs(limit = 50): Promise<WechatPublishJob[]> {
  try {
    const rows = await prisma.wf_wechat_publish_jobs.findMany({
      orderBy: { created_at: "desc" },
      take: limit,
    });
    return (rows as JobRow[]).map(rowToJob);
  } catch (e) {
    throw new Error(`读取发布历史失败：${(e as Error).message}`);
  }
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
  const row: Prisma.wf_wechat_publish_jobsUncheckedUpdateInput = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.summary !== undefined) row.summary = patch.summary;
  if (patch.author !== undefined) row.author = patch.author;
  if (patch.bodyHtml !== undefined) row.body_html = patch.bodyHtml;
  if (patch.thumbUrl !== undefined) row.thumb_url = patch.thumbUrl;
  if (patch.channel !== undefined) row.channel = patch.channel;
  if (patch.theme !== undefined) row.theme = patch.theme;
  if (patch.publishTime !== undefined) row.publish_time = patch.publishTime != null ? BigInt(patch.publishTime) : null;
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
  try {
    await prisma.wf_wechat_publish_jobs.update({ where: { id }, data: row });
  } catch (e) {
    throw new Error(`更新发布任务失败：${(e as Error).message}`);
  }
}

export async function deleteWechatJob(id: string): Promise<boolean> {
  let before: { id: string } | null;
  try {
    before = await prisma.wf_wechat_publish_jobs.findUnique({ where: { id }, select: { id: true } });
  } catch {
    return false;
  }
  if (!before) return false;
  try {
    await prisma.wf_wechat_publish_jobs.delete({ where: { id } });
  } catch (e) {
    throw new Error(`删除发布任务失败：${(e as Error).message}`);
  }
  return true;
}
