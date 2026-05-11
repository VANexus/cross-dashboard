"use client";

import { useFetch, apiGet } from "./use-fetch";
import type { Agent, SubAgent } from "@/lib/types";

export function useAgents(filters?: { status?: string; type?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.type) params.set("type", filters.type);
  const qs = params.toString();
  return useFetch<Agent[]>(`/api/agents${qs ? `?${qs}` : ""}`);
}

export function useAgent(id: string | null) {
  return useFetch<Agent & { subAgents: SubAgent[] }>(id ? `/api/agents/${id}` : null);
}

export async function fetchAgent(id: string) {
  return apiGet<Agent & { subAgents: SubAgent[] }>(`/api/agents/${id}`);
}
