"use client";

import { useFetch } from "./use-fetch";
import type { DashboardStats, BusinessMetrics, WorkflowStatus, Alert } from "@/lib/types";

interface DashboardData {
  stats: DashboardStats;
  businessMetrics: BusinessMetrics;
  workflows: WorkflowStatus[];
  alerts: Alert[];
  trends: {
    sales: number[];
    acos: number[];
    conversion: number[];
  };
}

export function useDashboard() {
  return useFetch<DashboardData>("/api/dashboard");
}
