"use client";

import { useFetch, apiGet, apiPost, apiPatch } from "./use-fetch";
import type { RiskEvent, HealthDimension, RiskIndicator } from "@/lib/types";

interface RiskEventsResponse {
  items: RiskEvent[];
}

interface HealthData {
  score: number;
  dimensions: HealthDimension[];
  indicators: RiskIndicator[];
}

export function useRiskEvents(filters?: {
  level?: string;
  resolved?: string;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.level) params.set("level", filters.level);
  if (filters?.resolved) params.set("resolved", filters.resolved);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
  const qs = params.toString();
  return useFetch<RiskEventsResponse>(`/api/risk/events${qs ? `?${qs}` : ""}`);
}

export function useRiskHealth() {
  return useFetch<HealthData>("/api/risk/health");
}

export function useIsolation() {
  return useFetch<{ items: { label: string; desc: string; checked: boolean }[] }>("/api/risk/isolation");
}

export async function createRiskEvent(data: {
  level: string;
  title: string;
  description: string;
  source: string;
  actions?: string[];
}) {
  return apiPost<RiskEvent>("/api/risk/events", data);
}

export async function updateRiskEvent(id: string, data: { resolved?: boolean; resolvedAt?: string }) {
  return apiPatch<RiskEvent>(`/api/risk/events/${id}`, data);
}

export async function updateIsolation(index: number, checked: boolean) {
  return apiPatch<{ items: { label: string; desc: string; checked: boolean }[] }>(
    "/api/risk/isolation",
    { index, checked }
  );
}
