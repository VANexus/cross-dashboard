"use client";

import { useFetch, apiPost } from "./use-fetch";
import type { InventoryItem, RestockSuggestion } from "@/lib/shared/types";

export function useInventory(filters?: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
  const qs = params.toString();
  return useFetch<{ items: InventoryItem[] }>(`/api/workflows/inventory${qs ? `?${qs}` : ""}`);
}

export function useRestockSuggestions() {
  return useFetch<RestockSuggestion[]>("/api/workflows/inventory/restock-suggestions");
}

export async function createRestockOrder(data: {
  items: { sku: string; qty: number; method: string }[];
}) {
  return apiPost("/api/workflows/inventory/restock-order", data);
}

export async function generateRestockSuggestions() {
  return apiPost("/api/workflows/inventory/generate-suggestions", {});
}
