"use client";

import { useFetch, apiPost, apiPatch } from "./use-fetch";
import type { EvolutionRecord, BeforeMetrics } from "@/lib/types";

interface EvolutionListResponse {
  items: EvolutionRecord[];
}

export function useEvolutions(filters?: {
  stage?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.stage) params.set("stage", filters.stage);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
  const qs = params.toString();
  return useFetch<EvolutionListResponse>(`/api/evolution${qs ? `?${qs}` : ""}`);
}

export function useEvolution(id: string | null) {
  return useFetch<EvolutionRecord & { beforeMetrics?: BeforeMetrics }>(
    id ? `/api/evolution/${id}` : null
  );
}

export function useEvolutionTrend(months?: number) {
  const qs = months ? `?months=${months}` : "";
  return useFetch<{ labels: string[]; data: number[] }>(`/api/evolution/trend${qs}`);
}

export async function createEvolution(data: {
  stage: string;
  title: string;
  description: string;
  agentId: string;
}) {
  return apiPost<EvolutionRecord>("/api/evolution", data);
}

export async function updateEvolution(id: string, data: Partial<EvolutionRecord>) {
  return apiPatch<EvolutionRecord>(`/api/evolution/${id}`, data);
}
