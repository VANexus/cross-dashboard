/**
 * 后台保鲜防抖：同 key 在 minIntervalMs 内只放行一次后台刷新。
 *
 * 用途：GET 路由「DB 秒回 + 过期后台保鲜」——用户高频在页面间来回切换时，
 * 防止每次导航都 fire-and-forget 一发付费 MCP/TikHub 刷新（进程级状态，
 * dev 热重载后重置，无害）。
 */
const lastRunAt = new Map<string, number>();

export function shouldBackgroundRefresh(key: string, minIntervalMs = 10 * 60_000): boolean {
  const now = Date.now();
  const last = lastRunAt.get(key) ?? 0;
  if (now - last < minIntervalMs) return false;
  lastRunAt.set(key, now);
  return true;
}

/** 测试/运维用：清空防抖状态 */
export function resetRefreshGate(): void {
  lastRunAt.clear();
}
