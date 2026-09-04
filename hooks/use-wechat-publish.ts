"use client";

import { useFetch, apiGet, apiPost, apiPatch, apiDelete } from "./use-fetch";
import type {
  WechatAccount, WechatAccountTestResult, WechatChannel, WechatPublishJob,
  WechatPublishStatus, WechatPublishStep, WechatPublishSubmitResult,
  WechatTypesetResult, WechatTypesetTheme,
} from "@/lib/shared/types";

// ── reads ──

export function useWechatAccounts() {
  return useFetch<WechatAccount[]>("/api/wechat/accounts");
}

export function useWechatJobs() {
  return useFetch<WechatPublishJob[]>("/api/wechat/publish");
}

export function useWechatThemes() {
  return useFetch<WechatTypesetTheme[]>("/api/wechat/typeset");
}

// ── accounts ──

export async function createWechatAccount(data: {
  label: string; appId: string; appSecret: string;
}): Promise<WechatAccount> {
  return apiPost<WechatAccount>("/api/wechat/accounts", data);
}

export async function updateWechatAccount(
  id: string,
  data: { label?: string; appId?: string; appSecret?: string; status?: WechatAccount["status"] },
): Promise<{ id: string }> {
  return apiPatch<{ id: string }>(`/api/wechat/accounts/${id}`, data);
}

export async function removeWechatAccount(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/api/wechat/accounts/${id}`);
}

export async function testWechatAccount(data: {
  id?: string; appId?: string; appSecret?: string;
}): Promise<WechatAccountTestResult> {
  return apiPost<WechatAccountTestResult>("/api/wechat/accounts/test", data);
}

// ── typeset ──

export async function typesetMarkdown(data: {
  markdown: string; theme?: string; primaryColor?: string; fontSize?: string;
}): Promise<WechatTypesetResult> {
  return apiPost<WechatTypesetResult>("/api/wechat/typeset", data);
}

// ── jobs ──

export async function createWechatJob(data: {
  title: string; bodyHtml: string; accountId?: string | null; summary?: string;
  author?: string; thumbUrl?: string; channel?: WechatChannel; theme?: string; publishTime?: number | null;
}): Promise<WechatPublishJob> {
  return apiPost<WechatPublishJob>("/api/wechat/publish", data);
}

export async function getWechatJob(id: string): Promise<WechatPublishJob> {
  return apiGet<WechatPublishJob>(`/api/wechat/publish/${id}`);
}

export async function updateWechatJob(
  id: string,
  data: Partial<{
    title: string; summary: string; author: string; bodyHtml: string; thumbUrl: string;
    channel: WechatChannel; theme: string; publishTime: number | null; accountId: string | null;
    status: WechatPublishStatus; step: WechatPublishStep;
  }>,
): Promise<{ id: string }> {
  return apiPatch<{ id: string }>(`/api/wechat/publish/${id}`, data);
}

export async function removeWechatJob(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/api/wechat/publish/${id}`);
}

export async function submitWechatJob(
  id: string,
  data: {
    accountId?: string | null; title: string; summary?: string; author?: string;
    bodyHtml: string; thumbUrl?: string; channel: WechatChannel; theme?: string;
    publishTime?: number | null; publish?: boolean;
  },
): Promise<WechatPublishSubmitResult> {
  return apiPost<WechatPublishSubmitResult>(`/api/wechat/publish/${id}/submit`, data);
}

export async function refreshWechatJob(id: string): Promise<WechatPublishJob> {
  return apiPost<WechatPublishJob>(`/api/wechat/publish/${id}/refresh`, {});
}
