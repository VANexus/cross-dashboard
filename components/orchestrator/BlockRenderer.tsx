"use client";

import type { OrchestratorBlock } from "@/lib/orchestrator/types";
import { TextBlock } from "./blocks/TextBlock";
import { ToolCallCard } from "./blocks/ToolCallCard";
import { ToolResultCard } from "./blocks/ToolResultCard";
import { OptionBubbles } from "./blocks/OptionBubbles";
import { IdeaBubble } from "./blocks/IdeaBubble";
import { ErrorBlock } from "./blocks/ErrorBlock";
import { DataTable } from "./blocks/DataTable";

interface BlockRendererProps {
  blocks: OrchestratorBlock[];
  onSelectOption: (blockId: string, optionId: string) => void;
  onIdeaAction: (blockId: string, params?: Record<string, unknown>) => void;
  disabled?: boolean;
}

/**
 * Generic block renderer — maps block.type → React component.
 * New block types are added here. The backend controls what blocks
 * are sent; the frontend just renders them.
 */
export function BlockRenderer({ blocks, onSelectOption, onIdeaAction, disabled }: BlockRendererProps) {
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "text":
            return <TextBlock key={i} block={block} />;

          case "tool_call":
            return (
              <ToolCallCard
                key={i}
                toolName={block.toolName}
                status={block.status}
                params={block.params}
                toolDescription={block.toolDescription}
              />
            );

          case "tool_result":
            return (
              <ToolResultCard
                key={i}
                toolName={block.toolName}
                summary={block.summary}
                data={block.data}
              />
            );

          case "chart":
            return <ChartBlock key={i} block={block} />;

          case "data_table":
            return (
              <DataTable
                key={i}
                columns={block.columns}
                rows={block.rows}
                title={block.title}
              />
            );

          case "options":
            return (
              <OptionBubbles
                key={i}
                question={block.question}
                options={block.options}
                blockId={block.blockId}
                onSelect={onSelectOption}
                disabled={disabled}
              />
            );

          case "idea_bubble":
            return (
              <IdeaBubble
                key={i}
                text={block.text}
                actionLabel={block.actionLabel}
                blockId={block.blockId}
                onAction={onIdeaAction}
                disabled={disabled}
              />
            );

          case "progress":
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{block.label}</span>
                  {block.percent !== undefined && <span>{block.percent}%</span>}
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/60 transition-all"
                    style={{ width: `${block.percent ?? 30}%` }}
                  />
                </div>
              </div>
            );

          case "error":
            return <ErrorBlock key={i} message={block.message} detail={block.detail} />;

          default:
            return null;
        }
      })}
    </div>
  );
}

// ── Inline Chart (simple bar chart using divs, no recharts dependency) ──

function ChartBlock({ block }: { block: { chartType: string; data: { label: string; value: number; color?: string }[]; title?: string; subtitle?: string } }) {
  const maxVal = Math.max(...block.data.map((d) => d.value), 1);

  if (block.chartType === "pie" || block.chartType === "donut") {
    const total = block.data.reduce((a, b) => a + b.value, 0);
    return (
      <div className="rounded-xl border border-border/30 p-4 space-y-3">
        {block.title && <p className="text-sm font-medium">{block.title}</p>}
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
              {block.data.reduce<{ elements: React.ReactNode[]; offset: number }>(
                (acc, item, i) => {
                  const pct = total > 0 ? (item.value / total) * 100 : 0;
                  const color = item.color || `hsl(${(i * 60) + 200}, 70%, 55%)`;
                  acc.elements.push(
                    <circle
                      key={i}
                      cx="18"
                      cy="18"
                      r="15.9"
                      fill="none"
                      stroke={color}
                      strokeWidth="3"
                      strokeDasharray={`${pct} ${100 - pct}`}
                      strokeDashoffset={`${-acc.offset}`}
                    />,
                  );
                  acc.offset += pct;
                  return acc;
                },
                { elements: [], offset: 0 },
              ).elements}
            </svg>
          </div>
          <div className="flex-1 space-y-1">
            {block.data.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: item.color || `hsl(${(i * 60) + 200}, 70%, 55%)` }}
                />
                <span className="text-foreground/70 truncate flex-1">{item.label}</span>
                <span className="font-medium tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Bar chart (default)
  return (
    <div className="rounded-xl border border-border/30 p-4 space-y-3">
      {block.title && <p className="text-sm font-medium">{block.title}</p>}
      {block.subtitle && <p className="text-xs text-muted-foreground">{block.subtitle}</p>}
      <div className="space-y-2">
        {block.data.map((item, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground/70 truncate">{item.label}</span>
              <span className="font-medium tabular-nums ml-2">{item.value}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(item.value / maxVal) * 100}%`,
                  background: item.color || `hsl(${(i * 60) + 200}, 70%, 55%)`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
