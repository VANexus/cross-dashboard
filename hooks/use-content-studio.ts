"use client";

import { useFetch, apiPost, apiPatch, apiDelete } from "./use-fetch";
import type {
  AuditResult, ContentIdea, ContentImageResult, ContentPlatform,
  ContentPlatformMeta, ContentWorks, CopyDraft, HotTopicsResult,
} from "@/lib/types";
import type { HotEngineResult, HotBoardType } from "@/lib/content/hot-engine";

export function usePlatforms() {
  return useFetch<ContentPlatformMeta[]>("/api/content-studio/platforms");
}

export function useIdeas(platform?: ContentPlatform) {
  return useFetch<ContentIdea[]>(platform ? `/api/content-studio/ideas?platform=${platform}` : null);
}

export function useHotTopics(platform: ContentPlatform, refresh = false) {
  return useFetch<HotTopicsResult>(
    `/api/content-studio/hot-topics?platform=${platform}${refresh ? "&refresh=1" : ""}`,
  );
}

/** 热榜引擎（多榜）消费 hook：综合/垂类/话题/灵感 + 选题卡 */
export function useHotBoards(
  platform: ContentPlatform,
  categories: string[] = [],
  key = "",
) {
  const cats = categories.join(",");
  return useFetch<HotEngineResult>(
    `/api/content-studio/hot-boards?platform=${platform}${cats ? `&categories=${encodeURIComponent(cats)}` : ""}${key ? `&boards=${key}` : ""}`,
  );
}

export function useDrafts() {
  return useFetch<CopyDraft[]>("/api/content-studio/copywriting");
}

export function useWorks() {
  return useFetch<ContentWorks>("/api/content-studio/works");
}

// ── mutations ──

export async function generateIdeas(data: {
  platform: ContentPlatform; subject: string; count?: number;
}): Promise<ContentIdea[]> {
  return apiPost<ContentIdea[]>("/api/content-studio/ideas", data);
}

export async function refreshHotTopics(data: { platform: ContentPlatform }): Promise<HotTopicsResult> {
  return apiPost<HotTopicsResult>("/api/content-studio/hot-topics", data);
}

/** 热榜引擎刷新：指定平台 + 可选品类偏好 + 可选榜型子集 */
export async function refreshHotBoards(data: {
  platform: ContentPlatform; categories?: string[]; boards?: HotBoardType[];
}): Promise<HotEngineResult> {
  return apiPost<HotEngineResult>("/api/content-studio/hot-boards", data);
}

export async function generateCopy(data: {
  platform: ContentPlatform; subject: string; angle?: string; tone?: string; keywords?: string[];
}): Promise<CopyDraft> {
  return apiPost<CopyDraft>("/api/content-studio/copywriting", data);
}

export async function auditDraft(id: string): Promise<AuditResult> {
  return apiPost<AuditResult>("/api/content-studio/audit", { id });
}

export async function generateImages(data: {
  draftId: string; platform: ContentPlatform; prompt: string; count?: number;
}): Promise<ContentImageResult> {
  return apiPost<ContentImageResult>("/api/content-studio/images", data);
}

export async function updateDraft(
  id: string,
  data: Partial<Pick<CopyDraft, "title" | "body" | "tags" | "status">>,
): Promise<CopyDraft> {
  return apiPatch<CopyDraft>(`/api/content-studio/copywriting/${id}`, data);
}

export async function removeDraft(id: string): Promise<{ deleted: boolean }> {
  return apiDelete<{ deleted: boolean }>(`/api/content-studio/copywriting/${id}`);
}
