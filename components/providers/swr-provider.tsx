"use client";

import { SWRConfig } from "swr";

/**
 * SWR 全局默认配置：
 * - focus 不重验（防止切标签页触发付费 API）
 * - 断网恢复重验（重连后静默变新）
 * - 60s 去重窗口（高频导航合并请求）
 */
export function SwrProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        revalidateIfStale: true,
        dedupingInterval: 60_000,
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  );
}
