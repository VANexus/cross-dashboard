"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
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

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <Suspense fallback={null}>
        <DiscoveryProvider>
          <TooltipProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <div className="flex flex-1 flex-col ml-[260px] transition-all duration-300">
                <TopBar />
                <main className="flex-1 p-6">{children}</main>
              </div>
            </div>
          </TooltipProvider>
        </DiscoveryProvider>
      </Suspense>
    </ThemeProvider>
  );
}
