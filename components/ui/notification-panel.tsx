"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  ShieldCheck,
  Info,
  X,
  ExternalLink,
  CheckCheck,
  Inbox,
  Loader2,
} from "lucide-react";
import Link from "next/link";

type NotificationLevel = "critical" | "warning" | "info";

interface Notification {
  id: string;
  level: NotificationLevel;
  title: string;
  description: string;
  time: string;
  href?: string;
  read?: boolean;
}

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
}

/* 等级视觉配置 */
const levelConfig: Record<
  NotificationLevel,
  { icon: typeof AlertTriangle; iconBg: string; iconColor: string; barColor: string }
> = {
  critical: {
    icon: AlertTriangle,
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    barColor: "bg-destructive",
  },
  warning: {
    icon: ShieldCheck,
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
    barColor: "bg-warning",
  },
  info: {
    icon: Info,
    iconBg: "bg-info/10",
    iconColor: "text-info",
    barColor: "bg-info",
  },
};

/* ── 时间格式化（相对时间） ── */
function relTime(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

/* localStorage 已读管理 */
const READ_KEY = "fm-notif-read";

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function NotificationPanel({ open, onClose, onUnreadChange }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const panelRef = useRef<HTMLDivElement>(null);

  /* 加载通知 */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const json = (await res.json()) as {
        success: boolean;
        data?: { notifications: Notification[] };
      };
      if (json.success && json.data) {
        setNotifications(json.data.notifications);
      }
    } catch {
      /* 保留上次数据 */
    } finally {
      setLoading(false);
    }
  }, []);

  /* 打开时加载 + 同步已读 */
  useEffect(() => {
    if (!open) return;
    const ids = getReadIds();
    const t = window.setTimeout(() => {
      setReadIds(ids);
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, load]);

  /* 计算未读数，通知外部 */
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;
  useEffect(() => {
    onUnreadChange?.(unreadCount);
  }, [unreadCount, onUnreadChange]);

  /* 标记单条已读 */
  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }, []);

  /* 全部已读 */
  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const n of notifications) next.add(n.id);
      saveReadIds(next);
      return next;
    });
  }, [notifications]);

  /* ESC 关闭 */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = filter === "unread"
    ? notifications.filter((n) => !readIds.has(n.id))
    : notifications;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 面板 */}
      <div
        ref={panelRef}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col",
          "glass-surface",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-300"
        )}
        data-state={open ? "open" : "closed"}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[15px] font-semibold tracking-tight">通知</h3>
            {unreadCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
                onClick={markAllRead}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                全部已读
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 筛选 Tab */}
        {notifications.length > 0 && (
          <div className="flex items-center gap-1 border-b border-border/40 px-3 py-2">
            {(["all", "unread"] as const).map((tab) => {
              const count = tab === "all"
                ? notifications.length
                : unreadCount;
              return (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                    filter === tab
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab === "all" ? "全部" : "未读"}
                  <span className="text-[10px] text-muted-foreground/70">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 通知列表 */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {loading && notifications.length === 0 && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                  <Inbox className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-[13px] text-muted-foreground">暂无通知</p>
              </div>
            )}

            {!loading && filtered.length === 0 && notifications.length > 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                  <CheckCheck className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-[13px] text-muted-foreground">全部已读</p>
              </div>
            )}

            <div className="space-y-0.5">
              {filtered.map((n) => {
                const cfg = levelConfig[n.level];
                const Icon = cfg.icon;
                const isUnread = !readIds.has(n.id);
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "group relative flex gap-3 rounded-lg p-3 transition-colors",
                      isUnread ? "bg-muted/30" : "hover:bg-muted/40"
                    )}
                    onClick={() => markRead(n.id)}
                  >
                    {/* 左侧色条 */}
                    {isUnread && (
                      <span
                        className={cn(
                          "absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full",
                          cfg.barColor
                        )}
                      />
                    )}

                    {/* 图标 */}
                    <div className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      cfg.iconBg
                    )}>
                      <Icon className={cn("h-3.5 w-3.5", cfg.iconColor)} />
                    </div>

                    {/* 内容 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-[13px] font-medium leading-[1.35]",
                          isUnread ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {n.title}
                        </p>
                        {isUnread && (
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      {n.description && (
                        <p className="mt-1 line-clamp-2 text-[12px] leading-[1.4] text-muted-foreground/80">
                          {n.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground/50">
                          {relTime(n.time)}
                        </span>
                        {n.href && (
                          <Link
                            href={n.href}
                            onClick={onClose}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            查看
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        {/* 底部刷新 */}
        <div className="border-t border-border/40 px-3 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-[12px] text-muted-foreground hover:text-foreground"
            onClick={() => load()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            刷新通知
          </Button>
        </div>
      </div>
    </>
  );
}
