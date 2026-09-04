"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/hooks/use-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { DiscoveryProvider } from "@/components/providers/discovery-provider";
import { useFocusTracking } from "@/lib/agent/use-focus-tracking";

const Sidebar = dynamic(
  () => import("@/components/layout/sidebar").then((m) => ({ default: m.Sidebar })),
  { ssr: false }
);

const TopBar = dynamic(
  () => import("@/components/layout/topbar").then((m) => ({ default: m.TopBar })),
  { ssr: false }
);

// ── AI-Native Agent 三面一体 ─────────────────────────────
// 三面 = 底部灵动岛(agent-dock) + 右侧对话侧栏(agent-drawer/sidebar 面) + 舞台即仪表盘(agent-drawer/stage 面)。
// dock ↔ sidebar ↔ stage 状态交换 GSAP 优先（FLIP 幽灵形变）；聚焦气泡随 sidebar 面追踪页面焦点。
// 已取代 FloatingAIButton + OrchestratorPanel + 单一智体球 + 独立追焦船台。
const AgentDock = dynamic(
  () => import("@/components/agent/agent-dock").then((m) => ({ default: m.AgentDock })),
  { ssr: false, loading: () => null }
);

const AgentDrawer = dynamic(
  () => import("@/components/agent/agent-drawer").then((m) => ({ default: m.AgentDrawer })),
  { ssr: false, loading: () => null }
);

const AgentPalette = dynamic(
  () => import("@/components/agent/agent-palette").then((m) => ({ default: m.AgentPalette })),
  { ssr: false, loading: () => null }
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useSidebar((s) => s.collapsed);
  // 全局追焦：观测 main#app-main 内带 data-agent-context/action 的元素，写入 presence.focus
  useFocusTracking();

  return (
    <ThemeProvider>
      <Suspense fallback={null}>
        <DiscoveryProvider>
          <TooltipProvider>
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              {/* min-w-0：允许内容列被抽屉挤压收缩（否则 min-width:auto 顶住 → 横向溢出）；
                  transition 限定 margin-left：不干扰 GSAP 对 margin-right 的逐帧挤压动画 */}
              <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col transition-[margin-left] duration-300", collapsed ? "ml-(--sidebar-width-collapsed)" : "ml-(--sidebar-width)")}>
                <TopBar />
                <main id="app-main" className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="page-container">{children}</div>
        </main>
              </div>
            </div>

            {/* 全局 AI 入口 — 灵动岛 + 侧栏/舞台一体面板 + ⌘K 计划面板,贯穿所有页面 */}
            <AgentDock />
            <AgentDrawer />
            <AgentPalette />

            {/* 全局操作反馈（sonner） */}
            <Toaster position="bottom-right" richColors closeButton />
          </TooltipProvider>
        </DiscoveryProvider>
      </Suspense>
    </ThemeProvider>
  );
}
