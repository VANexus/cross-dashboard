"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusDot } from "@/components/ui/status-dot";
import { getNavGroups, type NavGroup } from "@/lib/workspaces/registry";
import { ChevronDown, ChevronsLeft, ChevronsRight, Workflow, Route, Sparkles } from "lucide-react";

/** AI 动态页面（/p/[slug]）清单项 */
interface DynamicPageItem {
  id: string;
  title: string;
  updated_at: string;
}

async function dynamicPagesFetcher(url: string): Promise<DynamicPageItem[]> {
  const res = await fetch(url);
  const json = (await res.json()) as { success: boolean; data?: DynamicPageItem[] };
  return json.success ? (json.data ?? []) : [];
}

function dotToStatus(dot?: string) {
  switch (dot) {
    case "running": return "success" as const;
    case "warning": return "warning" as const;
    case "error": return "danger" as const;
    case "idle": return "idle" as const;
    default: return undefined;
  }
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  // 折叠的分组（Linear 式：组头可点击收起；空 = 全展开）
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const navGroups = useMemo(() => getNavGroups(), []);

  // M5 导航注入：agent 生成的 /p/[slug] 动态页 → 「AI 动态页面」分组（缓存 + 3min 轮询）
  const { data: dynamicPages } = useSWR("/api/agent/pages", dynamicPagesFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    refreshInterval: 180_000,
  });
  const fullNavGroups = useMemo<NavGroup[]>(() => {
    const pages = dynamicPages ?? [];
    if (pages.length === 0) return navGroups;
    return [
      ...navGroups,
      {
        workspaceId: "ai-generated",
        label: "AI 动态页面",
        icon: Sparkles,
        items: pages.map((p) => ({ label: p.title, href: `/p/${p.id}`, icon: Sparkles })),
      },
    ];
  }, [navGroups, dynamicPages]);

  const toggleGroup = (id: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-30 flex h-screen flex-col border-r bg-card transition-[width] duration-200",
        collapsed ? "w-(--sidebar-width-collapsed)" : "w-(--sidebar-width)"
      )}
    >
      {/* Logo */}
      <div className={cn("flex h-13 items-center border-b px-4", collapsed && "justify-center px-0")}>
        <Link href="/journeys" className="flex items-center gap-2.5">
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

      {/* Navigation — 由 lib/workspaces registry 派生（插件式空间） */}
      <ScrollArea className="flex-1 py-3 scrollbar-thin">
        <nav className="flex flex-col gap-4 px-2">
          {/* 编排中心固定入口 */}
          <div>
            <Link
              href="/journeys"
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-body transition-all duration-100",
                pathname === "/journeys" || pathname.startsWith("/journeys/")
                  ? "bg-primary/8 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? "流程编排中心" : undefined}
            >
              <Route className="h-4 w-4 shrink-0" />
              {!collapsed && <span>流程编排中心</span>}
            </Link>
          </div>

          {fullNavGroups.map((group) => {
            const isGroupCollapsed = collapsedGroups.has(group.workspaceId);
            const groupActive = group.items.some(
              (item) => pathname === item.href || pathname.startsWith(item.href + "/")
            );
            return (
              <div key={group.workspaceId}>
                <button
                  type="button"
                  onClick={() => !collapsed && toggleGroup(group.workspaceId)}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-md px-2.5 pb-1 pt-0.5 text-tiny font-medium uppercase tracking-widest text-muted-foreground/40",
                    !collapsed && "cursor-pointer hover:text-muted-foreground"
                  )}
                  title={collapsed ? group.label : undefined}
                  aria-expanded={!isGroupCollapsed}
                >
                  {!collapsed && (
                    <>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 shrink-0 transition-transform duration-150",
                          isGroupCollapsed && "-rotate-90"
                        )}
                      />
                      <span className="truncate">{group.label}</span>
                      {groupActive && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden />
                      )}
                    </>
                  )}
                  {collapsed && groupActive && (
                    <span className="mx-auto h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden />
                  )}
                </button>
                {(!isGroupCollapsed || collapsed) && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                      const status = dotToStatus(item.dot);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-body transition-all duration-100",
                            isActive
                              ? "bg-primary/8 text-primary font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                            collapsed && "justify-center px-0"
                          )}
                          title={collapsed ? item.label : undefined}
                        >
                          {status && (
                            <StatusDot
                              status={status}
                              pulse={item.dot === "running"}
                              size="sm"
                              className={cn(collapsed && "absolute top-1 right-1")}
                            />
                          )}
                          <span className="shrink-0"><Icon className="h-4 w-4" /></span>
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
