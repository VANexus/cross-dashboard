"use client";

import { cn } from "@/lib/utils";

interface Column {
  key: string;
  label: string;
  format?: "text" | "number" | "percent" | "badge";
}

interface DataTableProps {
  columns: Column[];
  rows: Record<string, unknown>[];
  title?: string;
}

export function DataTable({ columns, rows, title }: DataTableProps) {
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/30 overflow-hidden">
      {title && (
        <div className="px-4 py-2 bg-muted/30 border-b border-border/30">
          <span className="text-xs font-medium text-foreground/80">{title}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/20 bg-muted/20">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left font-medium text-muted-foreground"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((row, i) => (
              <tr
                key={i}
                className="border-b border-border/10 hover:bg-muted/10 transition-colors"
              >
                {columns.map((col) => {
                  const val = row[col.key];
                  return (
                    <td key={col.key} className="px-3 py-2">
                      <CellContent value={val} format={col.format} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 20 && (
        <div className="px-4 py-2 bg-muted/10 text-[10px] text-muted-foreground text-center">
          显示前 20 条，共 {rows.length} 条
        </div>
      )}
    </div>
  );
}

function CellContent({ value, format }: { value: unknown; format?: string }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/50">—</span>;
  }

  if (format === "percent") {
    const num = Number(value);
    return (
      <span className={cn(
        "font-medium",
        num > 30 ? "text-red-500" : num > 15 ? "text-amber-500" : "text-emerald-500",
      )}>
        {num.toFixed(1)}%
      </span>
    );
  }

  if (format === "number") {
    return <span className="font-medium tabular-nums">{Number(value).toLocaleString()}</span>;
  }

  if (format === "badge") {
    return (
      <span className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
        String(value) === "high" || String(value) === "紧急"
          ? "bg-red-500/10 text-red-500"
          : String(value) === "medium" || String(value) === "中等"
          ? "bg-amber-500/10 text-amber-500"
          : "bg-emerald-500/10 text-emerald-500",
      )}>
        {String(value)}
      </span>
    );
  }

  return <span className="text-foreground/80">{String(value)}</span>;
}
