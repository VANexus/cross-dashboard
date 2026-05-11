"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">加载任务详情失败</h3>
            <p className="text-xs text-muted-foreground">{error.message}</p>
          </div>
          <Button onClick={reset} size="sm" className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
