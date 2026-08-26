"use client";

import { useState, useEffect, useCallback, useMemo, startTransition } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, LayoutDashboard, Video, PenLine, ShieldCheck, Bot, ListTodo, Brain, Sparkles, Settings, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface CommandItem {
  id: string;
  label: string;
  category: string;
  icon: React.ReactNode;
  href: string;
  keywords: string[];
  /** 是否为 AI 动作（非导航） */
  isAIAction?: boolean;
}

const commandItems: CommandItem[] = [
  { id: "dashboard", label: "仪表盘", category: "概览", icon: <LayoutDashboard className="h-4 w-4" />, href: "/dashboard", keywords: ["首页", "总览", "dashboard"] },
  { id: "video-localization", label: "视频本地化", category: "内容工作台", icon: <Video className="h-4 w-4" />, href: "/workflows/video-localization", keywords: ["视频", "本地化", "video", "localization"] },
  { id: "content-studio", label: "内容创作中心", category: "内容工作台", icon: <PenLine className="h-4 w-4" />, href: "/content-studio", keywords: ["内容", "创作", "文案", "content"] },
  { id: "agents", label: "Agent 管理", category: "监控中心", icon: <Bot className="h-4 w-4" />, href: "/agents", keywords: ["agent", "智能体"] },
  { id: "tasks", label: "任务中心", category: "监控中心", icon: <ListTodo className="h-4 w-4" />, href: "/tasks", keywords: ["任务", "task"] },
  { id: "risk", label: "内容合规", category: "监控中心", icon: <ShieldCheck className="h-4 w-4" />, href: "/risk", keywords: ["合规", "风险", "risk", "账号"] },
  { id: "memory", label: "记忆系统", category: "系统", icon: <Brain className="h-4 w-4" />, href: "/memory", keywords: ["记忆", "memory"] },
  { id: "evolution", label: "自进化", category: "系统", icon: <Sparkles className="h-4 w-4" />, href: "/evolution", keywords: ["进化", "evolution"] },
  { id: "settings", label: "设置", category: "系统", icon: <Settings className="h-4 w-4" />, href: "/settings", keywords: ["设置", "settings"] },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 唤起 AI 助手的回调 */
  onInvokeAI?: () => void;
}

export function CommandPalette({ open, onOpenChange, onInvokeAI }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = query.trim()
    ? commandItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.keywords.some((k) => k.includes(query.toLowerCase()))
      )
    : commandItems;

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  const flatItems = useMemo(() => Object.values(grouped).flat(), [grouped]);

  useEffect(() => {
    startTransition(() => {
      setQuery("");
      setSelectedIndex(0);
    });
  }, [open]);

  useEffect(() => {
    startTransition(() => {
      setSelectedIndex(0);
    });
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && flatItems[selectedIndex]) {
        e.preventDefault();
        const item = flatItems[selectedIndex];
        onOpenChange(false);
        if (item.isAIAction && onInvokeAI) {
          onInvokeAI();
        } else {
          window.location.href = item.href;
        }
      }
    },
    [flatItems, selectedIndex, onOpenChange, onInvokeAI]
  );

  let globalIndex = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 gap-0 max-w-lg glass-surface" onKeyDown={handleKeyDown}>
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索页面、工作流、Agent..."
            className="border-0 focus-visible:ring-0 shadow-none h-11 bg-transparent"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1 scrollbar-thin">
          {/* AI 快捷入口 — 始终显示在顶部 */}
          {onInvokeAI && (
            <div className="stagger-in">
              <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground/60">AI 助手</p>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onInvokeAI();
                }}
                className="group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors text-foreground hover:bg-muted"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <MessageSquare className="h-4 w-4" />
                </span>
                询问 AI 助手
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                  ⌘⇧A
                </kbd>
              </button>
            </div>
          )}

          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="stagger-in">
              <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground/60">{category}</p>
              {items.map((item) => {
                globalIndex++;
                const idx = globalIndex;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                      idx === selectedIndex
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <span className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                      idx === selectedIndex ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground group-hover:text-foreground"
                    )}>
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
          {flatItems.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">无匹配结果</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
