"use client";

import { Loader2, CheckCircle2, XCircle, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCallCardProps {
  toolName: string;
  status: "pending" | "running" | "done" | "error";
  params?: Record<string, unknown>;
  toolDescription?: string;
}

export function ToolCallCard({ toolName, status, params, toolDescription }: ToolCallCardProps) {
  const isRunning = status === "running" || status === "pending";
  const isDone = status === "done";

  return (
    <div className={cn(
      "rounded-xl border bg-muted/30 px-4 py-3 space-y-2",
      isDone && "border-emerald-500/20 bg-emerald-500/5",
      status === "error" && "border-red-500/20 bg-red-500/5",
    )}>
      <div className="flex items-center gap-2">
        {isRunning ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : isDone ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">{toolName}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {isRunning ? "执行中..." : isDone ? "完成" : "失败"}
        </span>
      </div>

      {toolDescription && (
        <p className="text-xs text-muted-foreground/70 pl-6">{toolDescription}</p>
      )}

      {params && Object.keys(params).length > 0 && isDone && (
        <div className="pl-6 flex flex-wrap gap-1.5">
          {Object.entries(params).slice(0, 4).map(([key, val]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-md bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              <span className="font-medium text-foreground/70">{key}:</span>
              {String(val).slice(0, 30)}
            </span>
          ))}
        </div>
      )}

      {isRunning && (
        <div className="pl-6">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-primary/50 animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}
