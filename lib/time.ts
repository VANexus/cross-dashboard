/**
 * lib/time.ts — 人性化时间格式化
 * 把原始 ISO / 时间戳转成用户可读的相对时间（「x s 前 / x m 前 / x h 前 / x d 前」），
 * 避免向运营操盘手暴露 UTC 原始串。跨页面共用。
 */

/** 相对时间标签；null/undefined/空串 → 未标注。非法值原样返回避免崩。 */
export function ageLabel(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "未标注";
  const t = new Date(typeof raw === "number" ? raw : raw).getTime();
  if (Number.isNaN(t)) return String(raw);
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s 前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m 前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h 前`;
  return `${Math.floor(sec / 86400)}d 前`;
}

/** 短日期：今天只显示时间，其余显示「昨天 / M月D日」。 */
export function shortDate(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const d = new Date(typeof raw === "number" ? raw : raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfDay) / 86400_000);
  if (dayDiff <= 0) return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (dayDiff === 1) return `昨天 ${d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
