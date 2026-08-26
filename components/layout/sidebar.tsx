"use client";

import Link from "next/link";
import { useSidebar } from "@/hooks/use-sidebar";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  PenLine,
  Video,
  Search,
  ImageIcon,
  Megaphone,
  Package,
  BarChart3,
  Crosshair,
  Globe,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** 工作流领域色状态点（tailwind bg-* 类，如 bg-wf-product） */
  dot?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * 侧栏信息架构 —— 以「核心能力 · 工作流」为内容核心，
 * 七条工作流用领域色状态点标注，系统页按职责分组。
 */
const navGroups: NavGroup[] = [
  {
    label: "概览",
    items: [
      { label: "仪表盘", href: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    ],
  },
  {
    label: "核心能力 · 工作流",
    items: [
      { label: "能力中心", href: "/skills", icon: <Workflow className="h-4 w-4" /> },
      { label: "选品分析", href: "/workflows/product-research", icon: <Search className="h-4 w-4" />, dot: "bg-wf-product" },
      { label: "AI 作图", href: "/workflows/ai-imaging", icon: <ImageIcon className="h-4 w-4" />, dot: "bg-wf-imaging" },
      { label: "AI 广告", href: "/workflows/ai-advertising", icon: <Megaphone className="h-4 w-4" />, dot: "bg-wf-ad" },
      { label: "AI 上架", href: "/workflows/ai-listing", icon: <Package className="h-4 w-4" />, dot: "bg-wf-listing" },
      { label: "库销比", href: "/workflows/inventory", icon: <BarChart3 className="h-4 w-4" />, dot: "bg-wf-inventory" },
      { label: "竞品广告", href: "/workflows/competitor-ads", icon: <Crosshair className="h-4 w-4" />, dot: "bg-wf-competitor" },
      { label: "视频本地化", href: "/workflows/video-localization", icon: <Video className="h-4 w-4" />, dot: "bg-wf-localize" },
    ],
  },
  {
    label: "内容与采集",
    items: [
      { label: "内容创作中心", href: "/content-studio", icon: <PenLine className="h-4 w-4" /> },
      { label: "爬虫中心", href: "/crawler", icon: <Globe className="h-4 w-4" /> },
    ],
  },
  {
    label: "智能体与任务",
    items: [
      { label: "Agent 管理", href: "/agents", icon: <Bot className="h-4 w-4" /> },
      { label: "任务中心", href: "/tasks", icon: <ListTodo className="h-4 w-4" /> },
    ],
  },
  {
    label: "风控与洞察",
    items: [
      { label: "内容合规", href: "/risk", icon: <ShieldCheck className="h-4 w-4" /> },
      { label: "记忆系统", href: "/memory", icon: <Brain className="h-4 w-4" /> },
      { label: "自进化", href: "/evolution", icon: <Sparkles className="h-4 w-4" /> },
    ],
  },
  {
    label: "系统",
    items: [
      { label: "设置", href: "/settings", icon: <Settings className="h-4 w-4" /> },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-30 flex h-screen flex-col border-r glass-nav transition-[width] duration-300",
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
            <span className="font-heading text-base font-bold tracking-tight">
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
                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
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
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        collapsed && "justify-center px-0"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {!collapsed && item.dot && (
                        <span className={cn("ml-auto h-1.5 w-1.5 shrink-0 rounded-full", item.dot)} />
                      )}
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
