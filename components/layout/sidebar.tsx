"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Bot,
  ListTodo,
  ShoppingCart,
  Megaphone,
  DollarSign,
  Scale,
  Database,
  ShieldAlert,
  Sparkles,
  Settings,
  ChevronLeft,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

const navSections = [
  {
    label: "概览",
    items: [
      { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
      { href: "/agents", label: "Agent 管理", icon: Bot },
      { href: "/tasks", label: "任务中心", icon: ListTodo },
    ],
  },
  {
    label: "业务模块",
    items: [
      { href: "/business/operations", label: "运营分析", icon: ShoppingCart },
      { href: "/business/marketing", label: "营销中心", icon: Megaphone },
      { href: "/business/finance", label: "财务中心", icon: DollarSign },
      { href: "/business/legal", label: "法务中心", icon: Scale },
    ],
  },
  {
    label: "系统",
    items: [
      { href: "/memory", label: "记忆系统", icon: Database },
      { href: "/risk", label: "风险熔断", icon: ShieldAlert },
      { href: "/evolution", label: "自进化追踪", icon: Sparkles },
      { href: "/settings", label: "系统设置", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-card transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold">FlowMind</span>
            <span className="text-[10px] text-muted-foreground">跨境电商智能编排</span>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 py-2">
        <nav className="flex flex-col gap-1 px-2">
          {navSections.map((section) => (
            <div key={section.label} className="mb-2">
              {!collapsed && (
                <div className="mb-1 px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </div>
              )}
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      collapsed && "justify-center px-0"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ChevronLeft className={cn("h-5 w-5 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>
    </aside>
  );
}
