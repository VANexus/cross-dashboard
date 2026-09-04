"use client";

/**
 * AI 实时任务流 — 真实数据版
 *
 * 取代旧的 mock 打字动画。数据源：GET /api/tasks（真实 Supabase 任务表）。
 * 刷新时机：data-changed 事件（编排工具执行 / 产物转化）+ 30s 兜底轮询。
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataChanged } from "@/hooks/use-data-changed";
import type { Task, TaskStatus } from "@/lib/shared/types";

const PAGE_SIZE = 8;

const STATUS_META: Record<TaskStatus, { label: string; className: string }> = {
  pending: { label: "待执行", className: "bg-muted text-muted-foreground" },
  running: { label: "运行中", className: "bg-info/15 text-info" },
  completed: { label: "已完成", className: "bg-success/15 text-success" },
  failed: { label: "失败", className: "bg-destructive/15 text-destructive" },
  cancelled: { label: "已取消", className: "bg-muted text-muted-foreground" },
};

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("zh-CN", { hour12: false });
  } catch {
    return "";
  }
}

export function AiLivePanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // 客户端 fetch 不经过 Next Data Cache，无需 cache 选项
      const res = await fetch(`/api/tasks?page=1&pageSize=${PAGE_SIZE}`);
      const json = await res.json();
      if (json.success) {
        setTasks(json.data as Task[]);
      }
    } catch {
      // 静默：面板为非关键路径
    } finally {
      setLoading(false);
    }
  }, []);

  // 数据联动：编排/任务变化 → 即时刷新
  useDataChanged(() => void load(), undefined, 400);

  // mount 即加载首屏数据（deferred：避免 effect 内同步 setState 触发级联渲染）
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  // 兜底轮询（外部系统直接写库的场景）
  useEffect(() => {
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const running = tasks.filter((t) => t.status === "running").length;

  return (
    <div className="glass dash-panel dash-ai-live" data-animate="panel" suppressHydrationWarning>
      <div className="dash-ai-live-head">
        <span className="dash-ai-title">
          <Sparkles className="spark" />
          AI 编排 · 实时任务流
        </span>
        <span className={cn("dash-ai-tag dash-step", running > 0 ? "running" : "")}>
          <span className={cn("dash-dot", running > 0 ? "ok" : "")} />
          {running > 0 ? `${running} 个任务运行中` : "空闲"}
        </span>
      </div>

      <div className="dash-stream">
        {loading && (
          <div className="ln">
            <span className="t">--:--:--</span>
            <span>加载任务中…</span>
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">暂无任务</p>
            <p className="text-xs text-muted-foreground/70">
              点击右上角「发起编排」，让 AI 开始干活 — 产物会自动流转到任务与内容库
            </p>
          </div>
        )}

        {!loading &&
          tasks.map((t) => {
            const meta = STATUS_META[t.status] ?? STATUS_META.pending;
            return (
              <Link
                key={t.id}
                href={`/tasks/${t.id}`}
                className="ln group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
              >
                <span className="t shrink-0">{fmtTime(t.createdAt)}</span>
                <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-tiny font-medium", meta.className)}>
                  {meta.label}
                </span>
                <span className="flex-1 truncate text-foreground/80 group-hover:text-foreground">
                  {t.title}
                </span>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
