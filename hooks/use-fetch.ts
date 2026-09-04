"use client";

import useSWR, { useSWRConfig } from "swr";

/** 生成/发布等长任务请求超时兜底：防止后端未起/网关慢时按钮无限 disabled、无反馈。
 *  超时后 AbortController 中断请求并抛出可读错误，由调用方（run/await）catch 后提示。 */
const REQUEST_TIMEOUT_MS = 45_000;

async function requestWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error("请求超时，服务暂时无响应，请稍后重试。");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function parseJson(res: Response): Promise<{ success: boolean; data?: unknown; error?: string }> {
  let json: { success: boolean; data?: unknown; error?: string };
  try {
    json = (await res.json()) as { success: boolean; data?: unknown; error?: string };
  } catch {
    throw new Error(`服务返回异常（HTTP ${res.status}），请稍后重试。`);
  }
  return json;
}

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
  const res = await requestWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await parseJson(res);
  if (!json.success) throw new Error(json.error ?? `请求失败（HTTP ${res.status}）`);
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
