"use client";

import { AlertCircle } from "lucide-react";

interface ErrorBlockProps {
  message: string;
  detail?: string;
}

export function ErrorBlock({ message, detail }: ErrorBlockProps) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-start gap-3">
      <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
        {detail && (
          <p className="text-xs text-muted-foreground mt-1 font-mono">{detail}</p>
        )}
      </div>
    </div>
  );
}
