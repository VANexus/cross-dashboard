"use client";

import { useFetch, apiPost, apiPatch } from "./use-fetch";
import type {
  AlibabaProductsEnvelope, B2BListingDraft, B2BPreference, B2BSettings,
  DailyRefreshResult, ImageSkill, KeywordTrendsResult, ListingPublishResult, ListingRecommendation,
  LongtailKeyword, PushTestResult, ReversePromptResult, TrendPlatform,
} from "@/lib/shared/types";

// ── 只读 ──

export function useKeywordTrends(platform: TrendPlatform) {
  return useFetch<KeywordTrendsResult>(`/api/b2b/keyword-trends?platform=${platform}`);
}

export function useB2BSettings() {
  return useFetch<B2BSettings>("/api/settings/b2b");
}

export function useLongtail(industry: string | null) {
  return useFetch<LongtailKeyword[]>(industry ? `/api/b2b/longtail?industry=${encodeURIComponent(industry)}` : null);
}

export function useB2BProducts() {
  return useFetch<AlibabaProductsEnvelope>("/api/b2b/products");
}

export function useListings() {
  return useFetch<B2BListingDraft[]>("/api/b2b/listing");
}

export function useImageSkills() {
  return useFetch<ImageSkill[]>("/api/b2b/image-skills");
}

// ── mutations ──

export function refreshKeywordTrends(data: { platform: TrendPlatform; industryId?: number; keyword?: string }): Promise<KeywordTrendsResult> {
  return apiPost<KeywordTrendsResult>("/api/b2b/keyword-trends", data);
}

export function generateLongtail(data: { industry: string; seedKeywords?: string[]; limit?: number }): Promise<LongtailKeyword[]> {
  return apiPost<LongtailKeyword[]>("/api/b2b/longtail", data);
}

export function refreshProducts(): Promise<AlibabaProductsEnvelope> {
  return apiPost<AlibabaProductsEnvelope>("/api/b2b/products", { refresh: true });
}

export function recommendProducts(data: {
  preference: B2BPreference; trendKeywords: KeywordTrendsResult["keywords"]; longtailKeywords: LongtailKeyword[];
}): Promise<ListingRecommendation[]> {
  return apiPost<ListingRecommendation[]>("/api/b2b/recommend", data);
}

export function generateListing(data: {
  productId: string; subject?: string; keyword?: string; preference: B2BPreference;
}): Promise<B2BListingDraft> {
  return apiPost<B2BListingDraft>("/api/b2b/listing", data);
}

export function publishListing(listingId: string): Promise<ListingPublishResult> {
  return apiPost<ListingPublishResult>("/api/b2b/listing/publish", { listingId });
}

export function reversePrompt(data: { imageUrl: string; hint?: string }): Promise<ReversePromptResult> {
  return apiPost<ReversePromptResult>("/api/b2b/image-skills/reverse", data);
}

export function createImageSkill(data: {
  name: string; coverUrl: string; reversedPrompt: string; styleTags: string[]; aspectRatio?: string; platform?: string;
}): Promise<ImageSkill> {
  return apiPost<ImageSkill>("/api/b2b/image-skills", data);
}

export function updateImageSkill(id: string, data: { name?: string; reversedPrompt?: string; styleTags?: string[]; aspectRatio?: string }): Promise<ImageSkill> {
  return apiPatch<ImageSkill>(`/api/b2b/image-skills/${id}`, data);
}

export function generateWithSkill(skillId: string, prompt?: string): Promise<{ index: number; url: string }[]> {
  return apiPost<{ index: number; url: string }[]>("/api/b2b/image-skills/generate", { skillId, prompt });
}

export function testPush(channel: "feishu" | "wecom"): Promise<PushTestResult> {
  return apiPost<PushTestResult>("/api/b2b/push-test", { channel });
}

export function triggerDailyRefresh(force = false, token?: string): Promise<DailyRefreshResult> {
  return apiPost<DailyRefreshResult>(`/api/b2b/daily-refresh${force ? "?force=1" : ""}`, { token: token ?? "" });
}

export function saveB2BSettings(patch: Partial<B2BSettings>): Promise<B2BSettings> {
  return apiPost<B2BSettings>("/api/settings/b2b", patch);
}

export async function uploadCover(file: File): Promise<{ path: string; url: string; size: number; type: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/b2b/image-skills/upload", { method: "POST", body: fd });
  if (!res.ok) {
    let msg = `上传失败：HTTP ${res.status}`;
    try {
      const json = await res.json();
      if (json?.error) msg = String(json.error);
    } catch {}
    throw new Error(msg);
  }
  const json = await res.json();
  if (!json?.success) throw new Error(json?.error ?? "上传失败");
  return json.data;
}