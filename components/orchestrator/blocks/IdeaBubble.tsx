"use client";

import { Lightbulb, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface IdeaBubbleProps {
  text: string;
  actionLabel?: string;
  blockId: string;
  onAction: (blockId: string, params?: Record<string, unknown>) => void;
  disabled?: boolean;
}

export function IdeaBubble({ text, actionLabel, blockId, onAction, disabled }: IdeaBubbleProps) {
  return (
    <div className={cn(
      "rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3",
      "flex items-start gap-3",
    )}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
        <Lightbulb className="h-4 w-4 text-amber-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground/90">{text}</p>
        {actionLabel && (
          <button
            onClick={() => onAction(blockId)}
            disabled={disabled}
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400",
              "transition-colors hover:bg-amber-500/20",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {actionLabel}
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
