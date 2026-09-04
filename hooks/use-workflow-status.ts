"use client";

import { useFetch } from "./use-fetch";
import type { WorkflowStatus } from "@/lib/shared/types";

export function useWorkflowStatuses() {
  return useFetch<WorkflowStatus[]>("/api/workflows/status");
}
