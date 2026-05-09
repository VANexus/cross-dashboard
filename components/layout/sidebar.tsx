"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusDot } from "@/components/ui/status-dot";
import {
  LayoutDashboard,
  Workflow,
  ShieldCheck,
  Bot,
  ListTodo,
  Brain,
  Sparkles,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Radar,
  Image,
  BarChart3,
  PackagePlus,
  Boxes,
  Target,
} from "lucide-react";

type WorkflowStatus = "running" | "idle" | "warning" | "error";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  wfStatus?: WorkflowStatus;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  accent?: boolean;
}

const navGroups: NavGroup[] = [
  {
    label: "概览",
    items: [
      { label: "仪表盘", href: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    ],
  },
  {
    label: "插件工作流",
    accent: true,
    items: [
      { label: "选品工作流", href: "/workflows/product-research", icon: <Radar className="h-4 w-4" />, wfStatus: "running" },
      { label: "AI 作图", href: "/workflows/ai-imaging", icon: <Image className="h-4 w-4" />, wfStatus: "idle" },
      { label: "AI 广告", href: "/workflows/ai-advertising", icon: <BarChart3 className="h-4 w-4" />, wfStatus: "running" },
      { label: "AI 上架", href: "/workflows/ai-listing", icon: <PackagePlus className="h-4 w-4" />, wfStatus: "idle" },
      { label: "库销比", href: "/workflows/inventory", icon: <Boxes className="h-4 w-4" />, wfStatus: "warning" },
      { label: "竞品广告分析", href: "/workflows/competitor-ads", icon: <Target className="h-4 w-4" />, wfStatus: "idle" },
    ],
  },
  {
    label: "监控中心",
    items: [
      { label: "账号风险", href: "/risk", icon: <ShieldCheck className="h-4 w-4" /> },
      { label: "Agent 管理", href: "/agents", icon: <Bot className="h-4 w-4" /> },
      { label: "任务中心", href: "/tasks", icon: <ListTodo className="h-4 w-4" /> },
    ],
  },
  {
    label: "系统",
    items: [
      { label: "记忆系统", href: "/memory", icon: <Brain className="h-4 w-4" /> },
      { label: "自进化", href: "/evolution", icon: <Sparkles className="h-4 w-4" /> },
      { label: "设置", href: "/settings", icon: <Settings className="h-4 w-4" /> },
    ],
  },
];

function wfStatusToDot(status?: WorkflowStatus) {
  switch (status) {
    case "running":
      return "success" as const;
    case "warning":
      return "warning" as const;
    case "error":
      return "danger" as const;
    default:
      return "idle" as const;
  }
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-30 flex h-screen flex-col border-r bg-card transition-[width] duration-300",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      <div className={cn("flex h-14 items-center border-b px-4", collapsed && "justify-center")}>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
            <Workflow className="h-4 w-4 text-primary" />
            <div className="absolute -inset-0.5 rounded-lg bg-primary/10 blur-sm -z-10" />
          </div>
          {!collapsed && (
            <span className="text-base font-bold tracking-tight">
              Flow<span className="text-primary">Mind</span>
            </span>
          )}
        </Link>
      </div>

      <ScrollArea className="flex-1 py-2 scrollbar-thin">
        <nav className="flex flex-col gap-1 px-2">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-2">
              {!collapsed && (
                <p className={cn(
                  "px-2 py-1.5 text-[11px] font-semibold uppercase tracking-widest",
                  group.accent ? "text-primary/70" : "text-muted-foreground/50"
                )}>
                  {group.label}
                </p>
              )}
              {group.accent && !collapsed && (
                <div className="relative ml-0 mb-1">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/60 to-primary/0 rounded-full" />
                </div>
              )}
              <div className={cn("space-y-0.5", group.accent && "pl-1 border-l-2 border-primary/20 ml-1")}>
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-all duration-150",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        collapsed && "justify-center px-0"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      {item.wfStatus !== undefined && (
                        <StatusDot
                          status={wfStatusToDot(item.wfStatus)}
                          pulse={item.wfStatus === "running"}
                          size="sm"
                          className={cn(collapsed && "absolute top-1 right-1")}
                        />
                      )}
                      <span className="shrink-0">{item.icon}</span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full gap-2 text-muted-foreground", collapsed && "px-0 justify-center")}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && <span className="text-xs">收起侧栏</span>}
        </Button>
      </div>
    </aside>
  );
}
