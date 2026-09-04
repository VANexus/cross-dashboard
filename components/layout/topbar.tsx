"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Search, Bell, Sun, Moon, User, ChevronDown, CirclePlay,
} from "lucide-react";
import { useTheme } from "next-themes";
import { getEnabledJourneys } from "@/lib/journeys/registry";
import { usePresence } from "@/stores/agent-presence";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CommandPalette = dynamic(
  () => import("@/components/ui/command-palette").then((m) => ({ default: m.CommandPalette })),
  { ssr: false }
);

const NotificationPanel = dynamic(
  () => import("@/components/ui/notification-panel").then((m) => ({ default: m.NotificationPanel })),
  { ssr: false }
);

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const enabledJourneys = getEnabledJourneys();

  // 主 Agent 实时动作
  const liveActivity = usePresence((s) => s.liveActivity);
  const setDrawerOpen = usePresence((s) => s.setDrawerOpen);
  const liveBusy = liveActivity && liveActivity.kind !== "idle";

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setCmdOpen((v) => !v);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b bg-background/80 backdrop-blur px-5">
        {/* Left: Search trigger — 紧凑 */}
        <Button
          variant="outline"
          className="h-7 w-[220px] justify-start gap-2 text-[12px] text-muted-foreground font-normal border-border/70"
          onClick={() => setCmdOpen(true)}
        >
          <Search className="h-3.5 w-3.5" />
          <span>搜索或输入指令…</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-[16px] select-none items-center rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground/80">
            ⌘K
          </kbd>
        </Button>

        {/* Right: Actions — 统一高度与间距 */}
        <div className="flex items-center gap-1">
          {/* Agent 实时状态：忙碌时显示一个脉冲点 + 文字 */}
          {liveBusy && (
            <button
              type="button"
              data-agent-action="live-status"
              onClick={() => setDrawerOpen(true)}
              className="mr-1 inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              title="点击打开 Agent 抽屉查看细节"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="hidden sm:inline truncate max-w-[80px]">
                {liveActivity?.text ?? "Agent 工作中"}
              </span>
            </button>
          )}

          {/* 发起流程 — 主按钮，突出 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-7 gap-1.5 px-3 mr-1" data-agent-action="start-journey">
                <CirclePlay className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[12px] font-medium">发起流程</span>
                <ChevronDown className="h-3 w-3 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">
                端到端业务旅程
              </DropdownMenuLabel>
              {enabledJourneys.map((j) => {
                const Icon = j.icon;
                return (
                  <DropdownMenuItem
                    key={j.id}
                    className="gap-2.5 text-[13px]"
                    onClick={() => router.push(`/journeys/${j.id}`)}
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="flex-1">{j.label}</span>
                    <span className="text-[11px] text-muted-foreground">{j.steps.length} 步</span>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2.5 text-[13px]" onClick={() => router.push("/journeys")}>
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                流程编排中心
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 分隔线 */}
          <div className="mx-1 h-4 w-px bg-border/70" />

          {/* 通知 — 图标按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-7 w-7 text-muted-foreground"
            onClick={() => setNotifOpen(true)}
          >
            <Bell className="h-[15px] w-[15px]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-sidebar" />
            )}
          </Button>

          {/* 主题切换 */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Moon className="h-[15px] w-[15px]" /> : <Sun className="h-[15px] w-[15px]" />}
            </Button>
          )}

          {/* 用户菜单 — 只有头像，更干净 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 ml-0.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-3 w-3 text-primary" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem className="gap-2 text-[13px]" onClick={() => router.push("/settings")}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                系统设置
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <NotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onUnreadChange={setUnreadCount}
      />
    </>
  );
}
