"use client";

import { useFetch, apiPost } from "./use-fetch";
import type { DataSource, ProductKeyword, PainPoint } from "@/lib/shared/types";

export function useDataSources() {
  return useFetch<DataSource[]>("/api/workflows/product-research/data-sources");
}

export function useProductKeywords(marketplace?: string) {
  const qs = marketplace ? `?marketplace=${marketplace}` : "";
  return useFetch<ProductKeyword[]>(`/api/workflows/product-research/keywords${qs}`);
}

export function usePainPoints() {
  return useFetch<PainPoint[]>("/api/workflows/product-research/pain-points");
}

export async function executeResearch(data: {
  marketplace: string;
  sources: string[];
  keywords?: string[];
  asins?: string[];
}) {
  return apiPost("/api/workflows/product-research/execute", data);
}
