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
// 主力 = 右侧对话抽屉；辅助 = 底部灵动岛(agent-dock) + 追焦船台(agent-float-dock)。
// 已取代 FloatingAIButton + OrchestratorPanel + 单一智体球。
const AgentDock = dynamic(
  () => import("@/components/agent/agent-dock").then((m) => ({ default: m.AgentDock })),
  { ssr: false, loading: () => null }
);

const AgentDrawer = dynamic(
  () => import("@/components/agent/agent-drawer").then((m) => ({ default: m.AgentDrawer })),
  { ssr: false, loading: () => null }
);

const AgentFloatDock = dynamic(
  () => import("@/components/agent/agent-float-dock").then((m) => ({ default: m.AgentFloatDock })),
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

            {/* 全局 AI 入口 — 灵动岛 + 右侧抽屉 + 追焦船台 + ⌘K 计划面板,贯穿所有页面 */}
            <AgentDock />
            <AgentDrawer />
            <AgentFloatDock />
            <AgentPalette />

            {/* 全局操作反馈（sonner） */}
            <Toaster position="bottom-right" richColors closeButton />
          </TooltipProvider>
        </DiscoveryProvider>
      </Suspense>
    </ThemeProvider>
  );
}
