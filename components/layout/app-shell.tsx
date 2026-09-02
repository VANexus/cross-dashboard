"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/hooks/use-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { DiscoveryProvider } from "@/components/providers/discovery-provider";

const Sidebar = dynamic(
  () => import("@/components/layout/sidebar").then((m) => ({ default: m.Sidebar })),
  { ssr: false }
);

const TopBar = dynamic(
  () => import("@/components/layout/topbar").then((m) => ({ default: m.TopBar })),
  { ssr: false }
);

// ── AI-Native Agent(GSAP MVP)────────────────────────────────
// 新的融入式智能体入口:智体球 + 右侧抽屉(真实挤压主内容)。
// 已取代 FloatingAIButton + OrchestratorPanel(独立聊天挂件),旧组件文件已删除。
const AgentOrb = dynamic(
  () => import("@/components/agent/agent-orb").then((m) => ({ default: m.AgentOrb })),
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

  return (
    <ThemeProvider>
      <Suspense fallback={null}>
        <DiscoveryProvider>
          <TooltipProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              {/* min-w-0：允许内容列被抽屉挤压收缩（否则 min-width:auto 顶住 → 横向溢出）；
                  transition 限定 margin-left：不干扰 GSAP 对 margin-right 的逐帧挤压动画 */}
              <div className={cn("flex min-w-0 flex-1 flex-col transition-[margin-left] duration-300", collapsed ? "ml-[72px]" : "ml-[260px]")}>
                <TopBar />
                <main id="app-main" className="min-w-0 flex-1 p-6">{children}</main>
              </div>
            </div>

            {/* 全局 AI 入口 — 智体球 + 右侧抽屉 + ⌘K 计划面板,贯穿所有页面 */}
            <AgentOrb />
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
