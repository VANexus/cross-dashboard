"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/hooks/use-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { OrchestratorProvider } from "@/components/providers/orchestrator-provider";
import { FloatingAIButton } from "@/components/orchestrator/FloatingAIButton";
import { OrchestratorPanel } from "@/components/orchestrator/OrchestratorPanel";
import { useOrchestratorUI } from "@/components/providers/orchestrator-provider";

const Sidebar = dynamic(
  () => import("@/components/layout/sidebar").then((m) => ({ default: m.Sidebar })),
  { ssr: false }
);

const TopBar = dynamic(
  () => import("@/components/layout/topbar").then((m) => ({ default: m.TopBar })),
  { ssr: false }
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useSidebar((s) => s.collapsed);

  return (
    <ThemeProvider>
      <TooltipProvider>
        <OrchestratorProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className={cn("flex flex-1 flex-col transition-all duration-300", collapsed ? "ml-[72px]" : "ml-[260px]")}>
              <TopBar />
              <main className="flex-1 p-6">{children}</main>
            </div>
          </div>

          {/* 全局 AI 编排入口 — 贯穿所有页面 */}
          <AIEntry />
        </OrchestratorProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

/** Inner component that consumes orchestrator context for panel rendering */
function AIEntry() {
  const { isOpen, close } = useOrchestratorUI();
  return (
    <>
      <FloatingAIButton />
      <OrchestratorPanel open={isOpen} onClose={close} />
    </>
  );
}
