"use client";

import { useFetch, apiPost } from "./use-fetch";
import type { KeywordItem, CompetitorEntry, AdPosition } from "@/lib/shared/types";

export function useCompetitorKeywords(type?: string) {
  const qs = type ? `?type=${type}` : "";
  return useFetch<KeywordItem[]>(`/api/workflows/competitor-ads/keywords${qs}`);
}

export function useCompetitors() {
  return useFetch<CompetitorEntry[]>("/api/workflows/competitor-ads/competitors");
}

export function useAdPositions() {
  return useFetch<AdPosition[]>("/api/workflows/competitor-ads/positions");
}

export async function analyzeCompetitor(data: {
  asins: string[];
  marketplace: string;
  includeKeywords?: boolean;
  includeAdStructure?: boolean;
}) {
  return apiPost("/api/workflows/competitor-ads/analyze", data);
}
