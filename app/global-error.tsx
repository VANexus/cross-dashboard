"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">系统异常</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            应用遇到意外错误，请尝试刷新页面或联系管理员。
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/60 font-mono">
              错误标识: {error.digest}
            </p>
          )}
          <Button onClick={reset} className="gap-2 mt-2">
            <RefreshCw className="h-4 w-4" />
            重试
          </Button>
        </div>
      </body>
    </html>
  );
}
