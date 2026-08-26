"use client";

import { useState, useMemo } from "react";
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
  Globe,
  Plug,
  Package,
  TrendingUp,
  Palette,
  Megaphone,
  ShoppingCart,
  BarChart3,
  Shield,
  Video,
  FileSearch,
} from "lucide-react";
import { useServiceRegistry } from "@/lib/discovery";

type WorkflowStatus = "running" | "idle" | "warning" | "error";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
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

/** 静态核心导航（始终显示） */
const STATIC_GROUPS: NavGroup[] = [
  {
    label: "概览",
    items: [
      { label: "仪表盘", href: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    ],
  },
  {
    label: "监控中心",
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

/**
 * 图标池 —— 动态、开放、零维护
 *
 * 设计意图：category 是开放集合（后端技能发现返回的任意标签），
 * 绝不可能用静态映射表穷举。我们维护一个「图标池」，用 category
 * 字符串的哈希值取模，稳定地分配一个图标。
 *
 * 这样任何新 category（"翻译"、"客服"、"财税"……）都会自动、
 * 确定性地得到一个图标，无需前端改代码。
 *
 * 使用预创建的 React 节点（模块级常量），避免在 render 中
 * 动态构造组件触发 react-hooks/static-components lint 规则。
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

/** 简单的字符串哈希（FNV-1a），确定性、分布均匀 */
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
  const [collapsed, setCollapsed] = useState(false);

  // ── 从发现注册表订阅动态技能分组 ──
  const manifests = useServiceRegistry((s) => s.manifests);
  const discovering = useServiceRegistry((s) => s.discovering);

  // 动态构建"插件服务"分组（从 discovered skills 按 category 聚合）
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

    // 转为 NavGroup 数组
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
    // 动态组插入到"概览"之后（即第二个位置）
    const groups = [...STATIC_GROUPS];
    groups.splice(1, 0, ...dynamicGroups);
    return groups;
  }, [dynamicGroups]);

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
                  {group.dynamic && discovering && (
                    <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary align-middle" />
                  )}
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
