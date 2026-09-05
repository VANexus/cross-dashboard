"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusDot } from "@/components/ui/status-dot";
import { getNavGroups } from "@/lib/workspaces/registry";
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
    default: return undefined; // idle 不渲染：避免满屏灰点噪音（仅运行中/预警/错误有语义）
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

  // 导航分桶（产品语义；标号/图标/状态点仍来自注册表，这里只定义归属）
  const BUCKETS: Array<{ key: string; label: string; hrefs: Set<string>; defaultCollapsed?: boolean }> = [
    { key: "overview", label: "概览指挥", hrefs: new Set(["/dashboard", "/profile", "/journeys", "/skills"]) },
    { key: "insight", label: "市场洞察", hrefs: new Set(["/b2b/intel", "/b2b/keyword-trends"]) },
    { key: "content", label: "内容与发布", hrefs: new Set(["/content-studio", "/content-studio/wechat", "/creations"]) },
    { key: "listing", label: "商品上架", hrefs: new Set(["/b2b/listing", "/b2b/image-skills"]) },
    {
      key: "workflows",
      label: "AI 工作流",
      hrefs: new Set([
        "/workflows/product-research", "/workflows/ai-imaging", "/workflows/ai-advertising",
        "/workflows/ai-listing", "/workflows/inventory", "/workflows/competitor-ads",
        "/workflows/video-localization",
      ]),
      defaultCollapsed: true,
    },
    { key: "system", label: "系统与运营", hrefs: new Set(["/settings", "/agents", "/memory", "/evolution", "/tasks", "/risk"]) },
  ];

  // 动态页面（/p/*）单独一组，不混进业务分桶
  const dynamicItems = (dynamicPages ?? []).map((p) => ({
    href: `/p/${p.id}`, label: p.title, icon: Sparkles, dot: undefined as string | undefined,
  }));

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-30 flex h-screen flex-col border-r bg-sidebar transition-[width] duration-200",
        collapsed ? "w-(--sidebar-width-collapsed)" : "w-(--sidebar-width)"
      )}
    >
      {/* Logo — 液态玻璃 header */}
      <div className={cn("glass-liquid flex h-13 items-center border-b px-4", collapsed && "justify-center px-0")}>
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
          {/* 产品语义分桶（注册表数据驱动） */}
          {BUCKETS.map((bucket) => {
            const items = allItems.filter((i) => bucket.hrefs.has(i.href));
            if (items.length === 0) return null;
            return (
              <NavGroup key={bucket.key} label={bucket.label} collapsedSidebar={collapsed} defaultCollapsed={bucket.defaultCollapsed}>
                {items.map((it) => (
                  <NavLink key={it.href} href={it.href} label={it.label} icon={it.icon} dot={it.dot}
                    collapsed={collapsed} pathname={pathname} />
                ))}
                {bucket.key === "workflows" && !collapsed && (
                  <p className="flex items-center gap-1.5 px-2.5 pt-0.5 text-[10px] text-muted-foreground/50" title="状态点图例">
                    <StatusDot status="success" size="sm" /><span>运行中</span>
                    <StatusDot status="warning" size="sm" /><span>预警</span>
                    <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" /><span>待命</span>
                  </p>
                )}
              </NavGroup>
            );
          })}

          {/* AI 动态页面：Agent 生成的 /p/[slug]，默认折叠不打扰 */}
          {dynamicItems.length > 0 && (
            <NavGroup label="AI 动态页面" collapsedSidebar={collapsed} defaultCollapsed>
              {dynamicItems.map((it) => (
                <NavLink key={it.href} href={it.href} label={it.label} icon={it.icon}
                  collapsed={collapsed} pathname={pathname} />
              ))}
            </NavGroup>
          )}
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
