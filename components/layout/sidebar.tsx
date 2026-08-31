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
  Radar,
  Image,
  BarChart3,
  PackagePlus,
  Boxes,
  Target,
  Globe,
  PenLine,
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
}

const navGroups: NavGroup[] = [
  {
    label: "概览",
    items: [
      { label: "仪表盘", href: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    ],
  },
  {
    label: "工作流",
    items: [
      { label: "能力中心", href: "/skills", icon: <Sparkles className="h-4 w-4" /> },
      { label: "选品工作流", href: "/workflows/product-research", icon: <Radar className="h-4 w-4" />, wfStatus: "running" },
      { label: "AI 作图", href: "/workflows/ai-imaging", icon: <Image className="h-4 w-4" />, wfStatus: "idle" },
      { label: "AI 广告", href: "/workflows/ai-advertising", icon: <BarChart3 className="h-4 w-4" />, wfStatus: "running" },
      { label: "AI 上架", href: "/workflows/ai-listing", icon: <PackagePlus className="h-4 w-4" />, wfStatus: "idle" },
      { label: "库销比", href: "/workflows/inventory", icon: <Boxes className="h-4 w-4" />, wfStatus: "warning" },
      { label: "竞品广告分析", href: "/workflows/competitor-ads", icon: <Target className="h-4 w-4" />, wfStatus: "idle" },
      { label: "视频本地化", href: "/workflows/video-localization", icon: <Globe className="h-4 w-4" /> },
    ],
  },
  {
    label: "B端运营",
    items: [
      { label: "关键词趋势", href: "/b2b/keyword-trends", icon: <BarChart3 className="h-4 w-4" /> },
      { label: "一键上架", href: "/b2b/listing", icon: <PackagePlus className="h-4 w-4" /> },
      { label: "生图 Skill 库", href: "/b2b/image-skills", icon: <Image className="h-4 w-4" /> },
    ],
  },
  {
    label: "内容",
    items: [
      { label: "内容创作中心", href: "/content-studio", icon: <PenLine className="h-4 w-4" /> },
    ],
  },
  {
    label: "监控",
    items: [
      { label: "账号风险", href: "/risk", icon: <ShieldCheck className="h-4 w-4" /> },
      { label: "Agent 管理", href: "/agents", icon: <Bot className="h-4 w-4" /> },
      { label: "任务中心", href: "/tasks", icon: <ListTodo className="h-4 w-4" /> },
      { label: "爬虫中心", href: "/crawler", icon: <Globe className="h-4 w-4" /> },
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
    case "running": return "success" as const;
    case "warning": return "warning" as const;
    case "error": return "danger" as const;
    default: return "idle" as const;
  }
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-30 flex h-screen flex-col border-r bg-card transition-[width] duration-200",
        collapsed ? "w-[64px]" : "w-[248px]"
      )}
    >
      {/* Logo */}
      <div className={cn("flex h-13 items-center border-b px-4", collapsed && "justify-center px-0")}>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <Workflow className="h-3.5 w-3.5 text-primary" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight">
              Flow<span className="text-primary">Mind</span>
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3 scrollbar-thin">
        <nav className="flex flex-col gap-4 px-2">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-all duration-100",
                        isActive
                          ? "bg-primary/8 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
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

      {/* Collapse toggle */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full gap-2 text-muted-foreground h-8", collapsed && "px-0 justify-center")}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && <span className="text-xs">收起</span>}
        </Button>
      </div>
    </aside>
  );
}
