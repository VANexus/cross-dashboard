"use client";

import { useFetch, apiGet, apiPost, apiPatch, apiDelete } from "./use-fetch";
import type { Task, TaskStep } from "@/lib/types";

interface TasksResponse {
  items: Task[];
}

export function useTasks(filters?: {
  status?: string;
  priority?: string;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.priority) params.set("priority", filters.priority);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
  const qs = params.toString();
  return useFetch<TasksResponse>(`/api/tasks${qs ? `?${qs}` : ""}`);
}

export function useTask(id: string | null) {
  return useFetch<Task>(id ? `/api/tasks/${id}` : null);
}

export async function createTask(data: {
  title: string;
  description: string;
  priority?: "low" | "medium" | "high" | "critical";
  assignedAgents?: string[];
}) {
  return apiPost<Task>("/api/tasks", data);
}

export async function updateTask(id: string, data: Partial<Task>) {
  return apiPatch<Task>(`/api/tasks/${id}`, data);
}

export async function deleteTask(id: string) {
  return apiDelete<{ id: string }>(`/api/tasks/${id}`);
}

export async function updateTaskStep(
  taskId: string,
  stepId: string,
  data: Partial<TaskStep>
) {
  return apiPatch<TaskStep>(`/api/tasks/${taskId}/steps/${stepId}`, data);
}
