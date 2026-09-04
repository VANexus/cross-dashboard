"use client";

import { useFetch, apiPost } from "./use-fetch";
import type { CrawlResult } from "@/lib/shared/crawler";

export interface StoreStatus {
  available: boolean;
  stores: Array<{ storeId: string; storeName: string; platformName: string; ip: string }>;
  running: Array<{ storeId: string; storeName: string; debugPort: number }>;
}

export function useCrawlerStatus() {
  return useFetch<StoreStatus>("/api/crawler/stores");
}

export function useCrawlerResults(limit = 20) {
  return useFetch<CrawlResult[]>(`/api/crawler/results?limit=${limit}`);
}

export async function extractData(storeId: string, url: string, type?: string) {
  return apiPost<CrawlResult>("/api/crawler/extract", { storeId, url, type });
}

export async function takeScreenshot(storeId: string, fullPage = false) {
  return apiPost<{ screenshot: string }>("/api/crawler/screenshot", { storeId, fullPage });
}
