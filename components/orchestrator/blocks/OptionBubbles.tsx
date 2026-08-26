"use client";

import { cn } from "@/lib/utils";
import type { OptionItem } from "@/lib/orchestrator/types";

interface OptionBubblesProps {
  question: string;
  options: OptionItem[];
  blockId: string;
  onSelect: (blockId: string, optionId: string) => void;
  disabled?: boolean;
}

export function OptionBubbles({ question, options, blockId, onSelect, disabled }: OptionBubblesProps) {
  return (
    <div className="space-y-2">
      {question && (
        <p className="text-xs text-muted-foreground font-medium">{question}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(blockId, opt.id)}
            disabled={disabled}
            className={cn(
              "group flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-4 py-2 text-sm",
              "transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            <span className="font-medium">{opt.label}</span>
            {opt.description && (
              <span className="text-[10px] text-muted-foreground">{opt.description}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
