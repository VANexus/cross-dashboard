import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { SwrProvider } from "@/components/providers/swr-provider";
import { GenUIProvider } from "@/components/providers/genui-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FlowMind | 多垂直智能内容编排",
  description: "视频本地化与多平台内容创作 · 智能编排与自进化",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="h-screen overflow-hidden bg-background font-sans antialiased">
        <SwrProvider>
          {/* genUI Provider 全局提层：SSR 与所有页面/抽屉/对话流共享 json-render context */}
          <GenUIProvider>
            <AppShell>{children}</AppShell>
          </GenUIProvider>
        </SwrProvider>
      </body>
    </html>
  );
}
