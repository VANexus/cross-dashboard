"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { useWorkflowStatuses } from "@/hooks/use-workflow-status";
import { useAgents } from "@/hooks/use-agents";
import { useOrchestratorUI } from "@/components/providers/orchestrator-provider";
import {
  Search,
  Bell,
  Sun,
  Moon,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Bot,
  Workflow,
  Sparkles,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: workflows } = useWorkflowStatuses();
  const { data: agents } = useAgents();
  const { open: openAI } = useOrchestratorUI();

  const runningCount = workflows?.filter((w) => w.status === "running").length ?? 0;
  const onlineCount = agents?.filter((a) => a.status === "online" || a.status === "busy").length ?? 0;

  useEffect(() => {
    startTransition(() => {
      setMounted(true);
    });
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
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b glass-nav px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="relative h-8 w-64 justify-start text-sm text-muted-foreground font-normal gap-2"
            onClick={() => setCmdOpen(true)}
          >
            <Search className="h-3.5 w-3.5" />
            <span>搜索...</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </Button>

          <div className="hidden md:flex items-center gap-3 ml-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Workflow className="h-3 w-3 text-emerald-500" />
              <span>{runningCount} 工作流运行中</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5">
              <Bot className="h-3 w-3 text-primary" />
              <span>{onlineCount} Agent 在线</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* AI 助手快捷按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8"
            onClick={openAI}
            title="AI 助手（⌘⇧A）"
          >
            <Sparkles className="h-4 w-4 text-primary" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8"
            onClick={() => setNotifOpen(true)}
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
          </Button>

          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 ml-1 h-8">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="hidden sm:inline text-sm">Admin</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="gap-2">
                <Settings className="h-4 w-4" /> 系统设置
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" /> 退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} onInvokeAI={openAI} />
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}
