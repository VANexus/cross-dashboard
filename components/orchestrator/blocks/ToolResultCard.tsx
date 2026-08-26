"use client";

import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface ToolResultCardProps {
  toolName: string;
  summary: string;
  data: Record<string, unknown>;
}

export function ToolResultCard({ toolName, summary, data }: ToolResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-emerald-500/5 transition-colors"
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {toolName}
          </div>
          <p className="text-xs text-muted-foreground truncate">{summary}</p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-emerald-500/10 px-4 py-3">
          <pre className="text-[11px] text-muted-foreground overflow-x-auto whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
