/**
 * FlowMind AI Orchestrator — Message Protocol & Types
 *
 * Backend-driven block protocol. Each block is a typed content unit
 * that the frontend renders generically. New block types = new
 * frontend components, no backend changes needed for display.
 */

// ── Block Types ──────────────────────────────────────────────────

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolCallBlock {
  type: "tool_call";
  toolId: string;
  toolName: string;
  status: "pending" | "running" | "done" | "error";
  params?: Record<string, unknown>;
  toolDescription?: string;
}

export interface ToolResultBlock {
  type: "tool_result";
  toolId: string;
  toolName: string;
  summary: string;
  data: Record<string, unknown>;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartBlock {
  type: "chart";
  chartType: "bar" | "line" | "pie" | "donut";
  data: ChartDataPoint[];
  title?: string;
  subtitle?: string;
}

export interface DataTableBlock {
  type: "data_table";
  columns: { key: string; label: string; format?: "text" | "number" | "percent" | "badge" }[];
  rows: Record<string, unknown>[];
  title?: string;
}

export interface OptionItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface OptionsBlock {
  type: "options";
  question: string;
  options: OptionItem[];
  blockId: string;
}

export interface IdeaBubbleBlock {
  type: "idea_bubble";
  text: string;
  relatedTool?: string;
  actionLabel?: string;
  blockId: string;
  params?: Record<string, unknown>;
}

export interface ProgressBlock {
  type: "progress";
  label: string;
  percent?: number;
}

export interface ErrorBlock {
  type: "error";
  message: string;
  detail?: string;
}

export type OrchestratorBlock =
  | TextBlock
  | ToolCallBlock
  | ToolResultBlock
  | ChartBlock
  | DataTableBlock
  | OptionsBlock
  | IdeaBubbleBlock
  | ProgressBlock
  | ErrorBlock;

// ── Stream Events ────────────────────────────────────────────────

export interface StreamEvent {
  id: string;
  role: "user" | "assistant" | "system";
  blocks: OrchestratorBlock[];
  finished: boolean;
  timestamp: number;
}

// ── Tool Definition ──────────────────────────────────────────────

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required?: boolean;
  enum?: (string | number)[];
  default?: unknown;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

// ── Request/Response ─────────────────────────────────────────────

export interface OrchestrateRequest {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  selectedOption?: { blockId: string; optionId: string };
}
