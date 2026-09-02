"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Search,
  Bell,
  Sun,
  Moon,
  User,
  Settings,
  ChevronDown,
  CirclePlay,
  Route,
} from "lucide-react";
import { useTheme } from "next-themes";
import { getEnabledJourneys } from "@/lib/journeys/registry";
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
  const [mounted, setMounted] = useState(false);
  const enabledJourneys = getEnabledJourneys();

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
      <header className="sticky top-0 z-20 flex h-13 items-center justify-between border-b bg-background/80 backdrop-blur-md px-5">
        {/* Left: Search trigger */}
        <Button
          variant="outline"
          className="h-8 w-56 justify-start gap-2 text-sm text-muted-foreground font-normal"
          onClick={() => setCmdOpen(true)}
        >
          <Search className="h-3.5 w-3.5" />
          <span>搜索...</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-4 select-none items-center rounded border bg-muted px-1 font-mono text-tiny text-muted-foreground">
            ⌘K
          </kbd>
        </Button>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {/* 发起流程 — journey registry 派生（Agent 稳定选择器：data-agent-action="start-journey"） */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="mr-1 h-8 gap-2 px-3" data-agent-action="start-journey">
                <CirclePlay className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">发起流程</span>
                <ChevronDown className="h-3 w-3 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                端到端业务旅程
              </DropdownMenuLabel>
              {enabledJourneys.map((j) => {
                const Icon = j.icon;
                return (
                  <DropdownMenuItem
                    key={j.id}
                    className="gap-2.5"
                    onClick={() => router.push(`/journeys/${j.id}`)}
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="flex-1">{j.label}</span>
                    <span className="text-xs text-muted-foreground">{j.steps.length} 步</span>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2.5" onClick={() => router.push("/journeys")}>
                <Route className="h-4 w-4 text-muted-foreground" />
                打开流程编排中心
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 text-muted-foreground"
            onClick={() => setNotifOpen(true)}
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
          </Button>

          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 ml-1 h-8 px-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-3 w-3 text-primary" />
                </div>
                <span className="hidden sm:inline text-sm">Admin</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem className="gap-2 text-sm">
                <Settings className="h-3.5 w-3.5" /> 系统设置
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}
