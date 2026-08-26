"use client";

import { useFetch, apiPost, apiDelete } from "./use-fetch";
import type { LocalizeTask, LocalizeHealth, LocalizeBatchReport } from "@/lib/types";

export function useLocalizeHealth() {
  return useFetch<LocalizeHealth>("/api/workflows/video-localization/health");
}

export function useLocalizeTasks() {
  return useFetch<LocalizeTask[]>("/api/workflows/video-localization");
}

export async function submitLocalizeBatch(data: {
  videoPaths: string[];
  targetLang?: string;
  sourceLang?: string;
  enableTts?: boolean;
  removeSubtitles?: boolean;
}): Promise<LocalizeBatchReport> {
  return apiPost<LocalizeBatchReport>("/api/workflows/video-localization/batch", data);
}

export async function cancelLocalizeTask(id: string): Promise<{
  cancelled: boolean;
  message: string;
  failureCategory?: string;
  retriable?: boolean;
  warning?: string;
}> {
  return apiDelete(`/api/workflows/video-localization/tasks/${encodeURIComponent(id)}`);
}

export async function retryLocalizeTask(id: string): Promise<{
  originalTaskId: string;
  newTaskId: string;
  failureCategory?: string;
  retriable?: boolean;
  message?: string;
}> {
  return apiPost(`/api/workflows/video-localization/tasks/${encodeURIComponent(id)}/retry`, {});
}