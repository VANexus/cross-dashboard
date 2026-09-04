"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusDot } from "@/components/ui/status-dot";
import { getNavGroups } from "@/lib/workspaces/registry";
import { usePresence } from "@/stores/agent-presence";
import {
  ChevronDown, ChevronsLeft, ChevronsRight, Sparkles,
} from "lucide-react";
import { useSidebar } from "@/hooks/use-sidebar";

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

interface NavLinkProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  dot?: string;
  collapsed: boolean;
  pathname: string;
  activeExact?: boolean;
  onNavigate?: () => void;
}

function NavLink({ href, label, icon: Icon, dot, collapsed, pathname, activeExact, onNavigate }: NavLinkProps) {
  const isActive = activeExact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");
  const status = dotToStatus(dot);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors",
        isActive
          ? "bg-primary/8 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
        collapsed && "justify-center px-0"
      )}
      title={collapsed ? label : undefined}
    >
      {status && (
        <StatusDot
          status={status}
          pulse={dot === "running"}
          size="sm"
          className={cn(collapsed && "absolute top-1 right-1")}
        />
      )}
      <Icon className="h-[15px] w-[15px] shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

interface GroupProps {
  label: string;
  collapsedSidebar: boolean;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}

function NavGroup({ label, collapsedSidebar, defaultCollapsed, children }: GroupProps) {
  const [open, setOpen] = useState(!defaultCollapsed);

  if (collapsedSidebar) {
    return <div className="space-y-0.5" title={label}>{children}</div>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-1.5 px-2.5 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/40",
          "cursor-pointer hover:text-muted-foreground/70"
        )}
        aria-expanded={open}
      >
        <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform duration-150", !open && "-rotate-90")} />
        <span className="truncate">{label}</span>
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useSidebar((s) => s.collapsed);
  const toggleCollapsed = useSidebar((s) => s.toggle);
  const setDrawerOpen = usePresence((s) => s.setDrawerOpen);
  const navGroups = useMemo(() => getNavGroups(), []);

  // M5 导航注入：agent 生成的 /p/[slug] 动态页 → 「AI 动态页面」
  const { data: dynamicPages } = useSWR("/api/agent/pages", dynamicPagesFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    refreshInterval: 180_000,
  });

  // 所有条目扁平化
  const allItems = useMemo(() => {
    const items: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }>; dot?: string; workspace: string }> = [];
    for (const g of navGroups) {
      for (const it of g.items) {
        items.push({ href: it.href, label: it.label, icon: it.icon, dot: it.dot, workspace: g.label });
      }
    }
    return items;
  }, [navGroups]);

  // 归类：工作台（核心）vs B端运营（独立分组，展开态）vs 工作流（折叠）
  const workspaceHrefs = new Set(["/journeys", "/dashboard", "/agents", "/memory", "/evolution", "/tasks", "/risk"]);
  // B端运营：独立显眼分组，覆盖情报/关键词趋势/一键上架/生图 Skill 四入口
  const b2bHrefs = new Set(["/b2b/intel", "/b2b/keyword-trends", "/b2b/listing", "/b2b/image-skills"]);
  const workspaceItems = allItems.filter((i) => workspaceHrefs.has(i.href));
  const b2bItems = allItems.filter((i) => b2bHrefs.has(i.href));
  const workflowItems = allItems.filter((i) => !workspaceHrefs.has(i.href) && !b2bHrefs.has(i.href) && i.href !== "/settings");
  const dynamicItems = (dynamicPages ?? []).map((p) => ({
    href: `/p/${p.id}`, label: p.title, icon: Sparkles, dot: undefined as string | undefined,
  }));

  const openDrawer = () => setDrawerOpen(true);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-30 flex h-screen flex-col border-r bg-sidebar transition-[width] duration-200",
        collapsed ? "w-(--sidebar-width-collapsed)" : "w-(--sidebar-width)"
      )}
    >
      {/* Logo — 紧凑 */}
      <div className={cn("flex h-13 items-center border-b px-4", collapsed && "justify-center px-0")}>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-primary/10">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6l8-3 8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          {!collapsed && (
            <span className="text-[14px] font-semibold tracking-tight">
              Flow<span className="text-primary">Mind</span>
            </span>
          )}
        </Link>
      </div>

      <ScrollArea className="flex-1 scrollbar-thin">
        <nav className="flex flex-col gap-3 px-2 py-3">
          {/* ⭐ AI 对话 — 全局第一入口，胶囊按钮 */}
          <button
            type="button"
            onClick={openDrawer}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[10px] bg-foreground px-3 py-2 text-[13px] font-medium text-background transition-all",
              "hover:opacity-90 active:scale-[0.98]",
              collapsed && "justify-center px-0"
            )}
            title={collapsed ? "AI 对话" : undefined}
          >
            <Sparkles className="h-[15px] w-[15px] shrink-0" />
            {!collapsed && <span className="truncate">AI 对话</span>}
            {!collapsed && (
              <kbd className="ml-auto rounded bg-background/15 px-1.5 py-0.5 font-mono text-[10px] text-background/70">
                ⌘K
              </kbd>
            )}
          </button>

          {/* 工作台：核心页面 */}
          <NavGroup label="工作台" collapsedSidebar={collapsed}>
            {workspaceItems.map((it) => (
              <NavLink key={it.href} href={it.href} label={it.label} icon={it.icon} dot={it.dot}
                collapsed={collapsed} pathname={pathname} />
            ))}
          </NavGroup>

          {/* B端运营：跨境 B2B 运营台，独立展开分组 */}
          <NavGroup label="B端运营" collapsedSidebar={collapsed}>
            {b2bItems.map((it) => (
              <NavLink key={it.href} href={it.href} label={it.label} icon={it.icon} dot={it.dot}
                collapsed={collapsed} pathname={pathname} />
            ))}
          </NavGroup>

          {/* 工作流：原子能力（默认折叠） */}
          <NavGroup label="工作流" collapsedSidebar={collapsed} defaultCollapsed>
            {[...workflowItems, ...dynamicItems].map((it) => (
              <NavLink key={it.href} href={it.href} label={it.label} icon={it.icon} dot={it.dot}
                collapsed={collapsed} pathname={pathname} />
            ))}
          </NavGroup>

          {/* 设置 — 单独放在底部区 */}
          <div className="mt-auto border-t border-border/60 pt-3">
            {allItems.filter(i => i.href === "/settings").map((it) => (
              <NavLink key={it.href} href={it.href} label={it.label} icon={it.icon}
                collapsed={collapsed} pathname={pathname} />
            ))}
          </div>
        </nav>
      </ScrollArea>

      {/* Collapse toggle — 更克制 */}
      <div className="border-t p-1.5">
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full gap-2 text-muted-foreground h-7", collapsed && "px-0 justify-center")}
          onClick={toggleCollapsed}
        >
          {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
          {!collapsed && <span className="text-[11.5px]">收起侧栏</span>}
        </Button>
      </div>
    </aside>
  );
}
