"use client";

import useSWR, { useSWRConfig } from "swr";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface FetchOptions {
  immediate?: boolean;
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data as T;
}

/**
 * 统一前端取数 hook（SWR 内核）：
 * - 跨页面导航客户端缓存命中 → 切页秒开，不再重复请求
 * - 相同请求 60s 内自动去重（dedupingInterval）
 * - 不做 focus 自动重验（防止切标签页触发付费 API 刷屏）；
 *   数据新鲜度由服务端「DB 秒回 + 后台保鲜」与手动 refetch 保证
 */
export function useFetch<T>(url: string | null, options: FetchOptions = {}) {
  const { immediate = true } = options;
  const { data, error, isLoading, mutate } = useSWR<T>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    revalidateIfStale: true,
    dedupingInterval: 60_000,
    revalidateOnMount: immediate ? undefined : false,
  });

  return {
    data: (data ?? null) as T | null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : "Unknown error") : null,
    refetch: (): Promise<T | undefined> => mutate(),
    /** 兼容旧 API：直接覆盖本地缓存（不触发重验） */
    setState: (patch: Partial<FetchState<T>>) => {
      if ("data" in patch) void mutate(patch.data as T | undefined, { revalidate: false });
    },
  };
}

/** 全局缓存操作（跨组件刷新同 URL 的 SWR 缓存） */
export function useGlobalMutate() {
  const { mutate } = useSWRConfig();
  return mutate;
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data as T;
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data as T;
}

export async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data as T;
}

export async function apiPut<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data as T;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "DELETE" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data as T;
}
