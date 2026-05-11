"use client";

import { useFetch, apiPatch, apiPost } from "./use-fetch";
import type { GeneratedImg, StoryboardFrame } from "@/lib/types";

export function useImages(type?: string) {
  const qs = type ? `?type=${type}` : "";
  return useFetch<GeneratedImg[]>(`/api/workflows/ai-imaging/images${qs}`);
}

export function useStoryboard() {
  return useFetch<StoryboardFrame[]>("/api/workflows/ai-imaging/storyboard");
}

export async function updateImage(id: string, data: Partial<GeneratedImg>) {
  return apiPatch<GeneratedImg>(`/api/workflows/ai-imaging/images/${id}`, data);
}

export async function generateImage(data: {
  type: string;
  prompt: string;
  model?: string;
  seed?: number;
  referenceImageId?: string;
}) {
  return apiPost("/api/workflows/ai-imaging/generate", data);
}
