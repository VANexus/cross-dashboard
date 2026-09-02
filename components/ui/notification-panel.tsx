"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  ShieldCheck,
  Info,
  X,
  ExternalLink,
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
  read: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    level: "critical",
    title: "库销比预警",
    description: "SKU-A001 库存可售78天，已超冗余阈值",
    time: "5分钟前",
    href: "/workflows/inventory",
    read: false,
  },
  {
    id: "2",
    level: "warning",
    title: "账号风险告警",
    description: "绩效通知: 新通知待处理",
    time: "30分钟前",
    href: "/risk",
    read: false,
  },
  {
    id: "3",
    level: "info",
    title: "AI 广告分析完成",
    description: "3个高ACOS词已标记，5个高转化词已标记",
    time: "1小时前",
    href: "/workflows/ai-advertising",
    read: true,
  },
  {
    id: "4",
    level: "info",
    title: "选品工作流完成",
    description: "分析了9个平台的数据，生成了差异化建议",
    time: "2小时前",
    href: "/workflows/product-research",
    read: true,
  },
  {
    id: "5",
    level: "warning",
    title: "侵权风险检测",
    description: "2个SKU检测到潜在侵权词",
    time: "3小时前",
    href: "/workflows/ai-listing",
    read: true,
  },
];

const levelConfig: Record<
  NotificationLevel,
  { icon: React.ReactNode; color: string; bg: string }
> = {
  critical: {
    icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  warning: {
    icon: <ShieldCheck className="h-4 w-4 text-warning" />,
    color: "text-warning",
    bg: "bg-warning/10",
  },
  info: {
    icon: <Info className="h-4 w-4 text-info" />,
    color: "text-info",
    bg: "bg-info/10",
  },
};

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const unreadCount = mockNotifications.filter((n) => !n.read).length;

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-[380px] glass-surface",
          "animate-slide-in-right"
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">通知</h3>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 text-tiny px-1 rounded-full">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground">
              全部已读
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[calc(100%-52px)]">
          <div className="p-2 space-y-1">
            {mockNotifications.map((n) => {
              const cfg = levelConfig[n.level];
              return (
                <div
                  key={n.id}
                  className={cn(
                    "group flex gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50",
                    !n.read && "bg-muted/30"
                  )}
                >
                  <div className={cn("mt-0.5 shrink-0 rounded-md p-1.5", cfg.bg)}>
                    {cfg.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm font-medium leading-4", !n.read && "text-foreground")}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {n.description}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-caption text-muted-foreground/60">{n.time}</span>
                      {n.href && (
                        <Link
                          href={n.href}
                          onClick={onClose}
                          className="inline-flex items-center gap-0.5 text-caption text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          查看 <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
