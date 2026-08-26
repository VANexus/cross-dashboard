# AI Orchestrator — Backend-Driven Conversational UX

> Date: 2026-08-27
> Status: Approved for implementation
> Goal: Replace "tool list + manual fill" with AI-native conversational orchestration canvas.

## Problem

Current UX is **tool-centric**: dashboard shows workflow status list, each workflow page is an isolated tool requiring manual parameter filling. AI only appears at the final generation step. Zero AI leverage for the hard parts (knowing what to ask, what parameters to use, what strategy to take).

## Vision

**AI Orchestrator Canvas** — a backend-driven conversational interface where:
- User states intent in natural language
- AI selects tools, fills parameters, executes workflows
- Results render as rich interactive blocks (charts, tables, option bubbles, idea bubbles)
- New idea bubbles emerge during analysis, enabling deep-dive discovery
- Backend is the single source of truth — frontend is a generic rendering engine

## Architecture

```
Frontend (React)                         Backend (Next.js API)
┌─────────────────────┐                  ┌──────────────────────────────┐
│ OrchestratorPanel   │ ── SSE stream ──→│ POST /api/orchestrate        │
│  └ BlockRenderer    │←─ typed blocks ──│  └ OrchestratorService       │
│     └ block types   │                  │     ├ Tool Registry (6 wf)   │
│                     │                  │     └ AI Provider (tool_use)  │
└─────────────────────┘                  └──────────────────────────────┘
```

## Message Protocol (Block Types)

```typescript
type Block =
  | { type: "text"; text: string }
  | { type: "tool_call"; toolId: string; toolName: string; status: "pending" | "running" | "done" | "error"; params?: Record<string, unknown> }
  | { type: "tool_result"; toolId: string; toolName: string; summary: string; data: unknown }
  | { type: "chart"; chartType: "bar" | "line" | "pie" | "donut"; data: ChartData; title?: string }
  | { type: "data_table"; columns: string[]; rows: Record<string, unknown>[]; title?: string }
  | { type: "options"; question: string; options: { id: string; label: string; description?: string }[]; blockId: string }
  | { type: "idea_bubble"; text: string; relatedTool?: string; actionLabel?: string; blockId: string }
  | { type: "progress"; label: string; percent?: number }
  | { type: "error"; message: string }
```

## Tool Registry

Backend-driven: each workflow tool registers with:
- `id`, `name`, `description` (for AI to understand)
- `parameters` (JSON Schema for AI to fill)
- `execute(params)` → returns structured result

Tools map 1:1 to WorkflowService methods:
1. `competitor_analyze` — analyzeCompetitor(asins, marketplace, keywords)
2. `ad_optimize` — analyze/optimize ad keywords
3. `listing_generate` — generate listing (title, bullets, description)
4. `listing_category` — category recommendations
5. `listing_infringement` — infringement check
6. `imaging_generate` — generate product images
7. `inventory_restock` — restock suggestions
8. `product_research` — product research & pain points

## AI Integration

Uses existing `getAIProvider()` with tool_use:
- Claude: native `tools` parameter in Messages API
- OpenAI: native `tools` parameter in Chat Completions
- Mock: simulates tool selection based on keyword matching

Orchestration loop:
1. Send user message + tool definitions to AI
2. If AI returns tool_calls → execute each → stream progress blocks
3. Feed tool results back to AI for interpretation
4. AI may return more tool_calls (multi-step) or final text + idea bubbles
5. Stream all blocks to frontend as SSE

## Frontend Components

- `OrchestratorPanel` — full-screen chat canvas (replaces AISidebar)
- `BlockRenderer` — maps block.type → React component
- Block components: TextBlock, ToolCallCard, ToolResultCard, InlineChart, DataTable, OptionBubbles, IdeaBubble, ProgressBlock
- `useOrchestrator` hook — manages SSE connection, message state, option selection
- `OrchestratorProvider` — global zustand store (replaces EdgeAgentProvider for AI chat)

## Migration

- Replace `EdgeAgentProvider` + `AISidebar` with `OrchestratorProvider` + `OrchestratorPanel`
- Remove A2A/MCP edge-agent dependencies from app-shell
- Remove mock-data pages (video-localization, content-studio if mock)
- Keep FloatingAIButton as entry point (wired to new provider)

## Success Criteria

1. User can say "分析竞品 B08N5WRWNW" → AI auto-fills ASIN, runs analysis, shows chart + table
2. During analysis, idea bubbles emerge ("发现 ACoS 偏高，要优化广告吗？")
3. User clicks idea bubble → triggers new tool execution
4. All 6 workflow subsystems accessible via conversation
5. Adding a new tool = adding one registry entry, zero frontend changes
