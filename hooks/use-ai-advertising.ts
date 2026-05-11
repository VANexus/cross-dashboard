"use client";

import { useFetch, apiPatch, apiPost } from "./use-fetch";
import type { AdKeyword } from "@/lib/types";

export function useAdKeywords(filters?: { type?: string; tag?: string }) {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.tag) params.set("tag", filters.tag);
  const qs = params.toString();
  return useFetch<AdKeyword[]>(`/api/workflows/ai-advertising/keywords${qs ? `?${qs}` : ""}`);
}

export async function updateAdKeyword(id: string, data: Partial<AdKeyword>) {
  return apiPatch<AdKeyword>(`/api/workflows/ai-advertising/keywords/${id}`, data);
}

export async function exportAdReport(format: "csv" | "xlsx") {
  return apiPost<{ url: string }>("/api/workflows/ai-advertising/export", { format });
}
