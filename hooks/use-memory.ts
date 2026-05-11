"use client";

import { useFetch, apiGet, apiPost, apiPut, apiDelete } from "./use-fetch";
import type { MemoryEntry, MemoryUsageStats } from "@/lib/types";

interface MemoryListResponse {
  items: MemoryEntry[];
}

export function useMemories(filters?: {
  zone?: string;
  type?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.zone) params.set("zone", filters.zone);
  if (filters?.type) params.set("type", filters.type);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
  const qs = params.toString();
  return useFetch<MemoryListResponse>(`/api/memory${qs ? `?${qs}` : ""}`);
}

export function useMemory(id: string | null) {
  return useFetch<MemoryEntry>(id ? `/api/memory/${id}` : null);
}

export function useMemoryUsage(id: string | null) {
  return useFetch<MemoryUsageStats>(id ? `/api/memory/${id}/usage` : null);
}

export async function createMemory(data: {
  zone: string;
  title: string;
  content: string;
  type: string;
  tags?: string[];
}) {
  return apiPost<MemoryEntry>("/api/memory", data);
}

export async function updateMemory(id: string, data: Partial<MemoryEntry>) {
  return apiPut<MemoryEntry>(`/api/memory/${id}`, data);
}

export async function deleteMemory(id: string) {
  return apiDelete<{ id: string }>(`/api/memory/${id}`);
}
