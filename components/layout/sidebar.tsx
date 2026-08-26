"use client";

import { useState, useMemo } from "react";
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
  Plug,
  TrendingUp,
  Palette,
  ShoppingCart,
  Shield,
  FileSearch,
} from "lucide-react";
import { useServiceRegistry } from "@/lib/discovery";
import type { WorkflowStatus } from "@/lib/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** 工作流领域色状态点（tailwind bg-* 类，如 bg-wf-product） */
  dot?: string;
  /** 工作流状态（用于服务发现动态项） */
  wfStatus?: WorkflowStatus;
  /** 来源服务 id（动态技能用） */
  serviceId?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  accent?: boolean;
  /** 是否来自服务发现（动态组） */
  dynamic?: boolean;
}

/** 静态核心导航（液态玻璃设计 + 领域色状态点） */
const STATIC_GROUPS: NavGroup[] = [
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
      { label: "视频本地化", href: "/workflows/video-localization", icon: <Video className="h-4 w-4" /> },
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

/**
 * 图标池 —— 动态、开放、零维护
 * 新 category 自动确定性分配图标，无需前端改代码
 */
const ICON_POOL: React.ReactNode[] = [
  <Workflow className="h-4 w-4" />,
  <Palette className="h-4 w-4" />,
  <Megaphone className="h-4 w-4" />,
  <ShoppingCart className="h-4 w-4" />,
  <Package className="h-4 w-4" />,
  <BarChart3 className="h-4 w-4" />,
  <TrendingUp className="h-4 w-4" />,
  <Globe className="h-4 w-4" />,
  <Brain className="h-4 w-4" />,
  <Sparkles className="h-4 w-4" />,
  <Shield className="h-4 w-4" />,
  <Video className="h-4 w-4" />,
  <FileSearch className="h-4 w-4" />,
  <Bot className="h-4 w-4" />,
  <Plug className="h-4 w-4" />,
];

/** FNV-1a 字符串哈希 */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function categoryIcon(category: string): React.ReactNode {
  const idx = hashString(category) % ICON_POOL.length;
  return ICON_POOL[idx];
}

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
  const { collapsed, setCollapsed } = useSidebar();

  // ── 从发现注册表订阅动态技能分组 ──
  const manifests = useServiceRegistry((s) => s.manifests);
  const discovering = useServiceRegistry((s) => s.discovering);

  // 动态构建"插件服务"分组
  const dynamicGroups: NavGroup[] = useMemo(() => {
    const categoryMap = new Map<string, NavItem[]>();

    for (const manifest of Object.values(manifests)) {
      const health = manifest.health;
      const status: WorkflowStatus =
        health === "connected" ? "running" :
        health === "degraded" ? "warning" :
        health === "unreachable" ? "error" : "idle";

      for (const skill of manifest.skills ?? []) {
        const category = skill.category ?? "通用";
        const item: NavItem = {
          label: skill.name,
          href: `/services/${manifest.serviceId}/skills/${skill.id}`,
          icon: categoryIcon(category),
          wfStatus: status,
          serviceId: manifest.serviceId,
        };
        const existing = categoryMap.get(category) ?? [];
        existing.push(item);
        categoryMap.set(category, existing);
      }
    }

    return [...categoryMap.entries()].map(([label, items]) => ({
      label,
      items,
      accent: true,
      dynamic: true,
    }));
  }, [manifests]);

  // 合并：静态组 + 动态组
  const navGroups = useMemo(() => {
    if (dynamicGroups.length === 0) return STATIC_GROUPS;
    const groups = [...STATIC_GROUPS];
    groups.splice(1, 0, ...dynamicGroups);
    return groups;
  }, [dynamicGroups]);

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
                  {group.dynamic && discovering && (
                    <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary align-middle" />
                  )}
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
