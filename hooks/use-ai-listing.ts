"use client";

import { useFetch, apiPost } from "./use-fetch";
import type { InfringementWord, CategoryRec, BulletPoint } from "@/lib/shared/types";

export function useInfringementWords() {
  return useFetch<InfringementWord[]>("/api/workflows/ai-listing/infringement");
}

export function useCategoryRecs() {
  return useFetch<CategoryRec[]>("/api/workflows/ai-listing/categories");
}

export function useBulletPoints() {
  return useFetch<BulletPoint[]>("/api/workflows/ai-listing/bullets");
}

export async function generateListing(data: {
  keyword?: string;
  marketplace: string;
  language: string;
  category?: string;
  tone?: string;
}) {
  return apiPost("/api/workflows/ai-listing/generate", data);
}

export async function publishListing(data: {
  title: string;
  bullets: string[];
  description: string;
  keywords: string[];
  category: string;
  marketplace: string;
}) {
  return apiPost<{ success: boolean; listingId: string }>("/api/workflows/ai-listing/publish", data);
}
