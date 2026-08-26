/**
 * FlowMind — Edge Agent 错误边界
 *
 * "use client" — 必须标记，因为错误边界需要客户端生命周期。
 */
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[EdgeAgent] 页面错误:", error);
  }, [error]);

  return (
    <div className="flex h-[calc(100vh-6rem)] items-center justify-center p-4">
      <div className="glass-panel max-w-md rounded-2xl p-6 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-4 text-lg font-semibold">边缘智能体出错</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "发生未知错误"}
        </p>
        <Button onClick={reset} className="mt-4" variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          重试
        </Button>
      </div>
    </div>
  );
}
