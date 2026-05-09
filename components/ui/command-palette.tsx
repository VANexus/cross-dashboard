"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, LayoutDashboard, Workflow, ShieldCheck, Bot, ListTodo, Brain, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface CommandItem {
  id: string;
  label: string;
  category: string;
  icon: React.ReactNode;
  href: string;
  keywords: string[];
}

const commandItems: CommandItem[] = [
  { id: "dashboard", label: "仪表盘", category: "页面", icon: <LayoutDashboard className="h-4 w-4" />, href: "/dashboard", keywords: ["首页", "总览", "dashboard"] },
  { id: "product-research", label: "选品工作流", category: "工作流", icon: <Workflow className="h-4 w-4" />, href: "/workflows/product-research", keywords: ["选品", "product", "research"] },
  { id: "ai-imaging", label: "AI 作图", category: "工作流", icon: <Workflow className="h-4 w-4" />, href: "/workflows/ai-imaging", keywords: ["作图", "图片", "imaging"] },
  { id: "ai-advertising", label: "AI 广告", category: "工作流", icon: <Workflow className="h-4 w-4" />, href: "/workflows/ai-advertising", keywords: ["广告", "advertising", "ad"] },
  { id: "ai-listing", label: "AI 上架", category: "工作流", icon: <Workflow className="h-4 w-4" />, href: "/workflows/ai-listing", keywords: ["上架", "listing"] },
  { id: "inventory", label: "库销比", category: "工作流", icon: <Workflow className="h-4 w-4" />, href: "/workflows/inventory", keywords: ["库存", "inventory", "补货"] },
  { id: "competitor-ads", label: "竞品广告分析", category: "工作流", icon: <Workflow className="h-4 w-4" />, href: "/workflows/competitor-ads", keywords: ["竞品", "competitor"] },
  { id: "risk", label: "账号风险", category: "监控", icon: <ShieldCheck className="h-4 w-4" />, href: "/risk", keywords: ["风险", "risk", "账号"] },
  { id: "agents", label: "Agent 管理", category: "监控", icon: <Bot className="h-4 w-4" />, href: "/agents", keywords: ["agent", "智能体"] },
  { id: "tasks", label: "任务中心", category: "监控", icon: <ListTodo className="h-4 w-4" />, href: "/tasks", keywords: ["任务", "task"] },
  { id: "memory", label: "记忆系统", category: "系统", icon: <Brain className="h-4 w-4" />, href: "/memory", keywords: ["记忆", "memory"] },
  { id: "evolution", label: "自进化", category: "系统", icon: <Workflow className="h-4 w-4" />, href: "/evolution", keywords: ["进化", "evolution"] },
  { id: "settings", label: "设置", category: "系统", icon: <Settings className="h-4 w-4" />, href: "/settings", keywords: ["设置", "settings"] },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
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

  const flatItems = Object.values(grouped).flat();

  useEffect(() => {
    setQuery("");
    setSelectedIndex(0);
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
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
        onOpenChange(false);
        window.location.href = flatItems[selectedIndex].href;
      }
    },
    [flatItems, selectedIndex, onOpenChange]
  );

  let globalIndex = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 gap-0 max-w-lg" onKeyDown={handleKeyDown}>
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索页面、工作流、Agent..."
            className="border-0 focus-visible:ring-0 shadow-none h-11"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1 scrollbar-thin">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
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
                      "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                      idx === selectedIndex
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <span className="text-muted-foreground">{item.icon}</span>
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
