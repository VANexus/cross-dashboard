"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** 相对时间：刚刚 / n 分钟前 / n 小时前 / n 天前 */
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "刚刚";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  return `${Math.floor(hour / 24)} 天前`;
}

/**
 * 数据新鲜度指示器：显示「更新于 x 前」，后台保鲜中带旋转图标。
 * 人性化：用户能一眼知道数据多新、是否正在悄悄变新，而不是面对无声的 loading。
 */
export function DataFreshness({
  fetchedAt,
  refreshing,
  className,
}: {
  fetchedAt?: string;
  refreshing?: boolean;
  className?: string;
}) {
  const [, tick] = useState(0);

  // 每分钟刷新一次相对时间显示
  useEffect(() => {
    if (!fetchedAt) return;
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [fetchedAt]);

  if (!fetchedAt) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      {refreshing && <RefreshCw className="size-3 animate-spin" aria-hidden />}
      更新于 {relativeTime(fetchedAt)}
      {refreshing && " · 后台更新中"}
    </span>
  );
}
