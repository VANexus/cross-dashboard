# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Task | Command |
|------|---------|
| Dev server | `bun run dev` |
| Production build | `bun run build` |
| Start production | `bun run start` |
| Lint | `bun run lint` |
| E2E tests | `bun run test:e2e` |
| Single E2E test | `bun run test:e2e -- path/to/test.spec.ts` |
| List E2E tests | `bun run test:e2e:list` |

Package manager is **Bun** (not npm/pnpm/yarn). There are no unit tests — only Playwright E2E in `e2e/`.

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Architecture

**FlowMind** — a cross-border e-commerce intelligent orchestration system (跨境电商智能编排系统). UI is entirely in Chinese (zh-CN).

### Layered architecture

```
API Routes (app/api/)  ←→  Services (lib/services/)  ←→  Repositories (lib/repositories/)  ←→  SQLite (lib/db/)
                                                       ↕
                                                  RAK Engine (lib/rak/)
                                                       ↕
                                                  AI Providers (lib/ai/)
```

### Data flow (two paths)

1. **Client-side**: React components → custom hooks (`hooks/use-*.ts`) → `fetch('/api/...')` → API Route Handler → Service → Repository → SQLite
2. **Server-side (SSR)**: Island components (`islands/*-island.tsx`) → Service → Repository → SQLite → pass data as props to client components

Both paths share the same SQLite database (sql.js, stored at `./data/flowmind.db`).

### Key directories

- `lib/db/` — Database singleton (sql.js WASM), schema, migrations, seed data. Use `getDbAsync()` for init, `getDb()` for sync access after init.
- `lib/repositories/` — Data access layer. Each entity has a repository (agent, task, risk, memory, evolution, workflow, rak). Use `paginatedQuery()` from `base.ts` for list endpoints.
- `lib/services/` — Business logic layer. Services are plain classes, instantiate as needed.
- `lib/rak/` — RAK protocol engine (coordinator, mesh executor, conflict resolver, consensus, scheduler).
- `lib/ai/` — AI provider adapters (Claude, OpenAI, mock). Provider-agnostic via adapter pattern.
- `lib/types.ts` — All shared TypeScript interfaces
- `lib/api-response.ts` — Standardized response helpers: `success()`, `error()`, `notFound()`, `badRequest()`, `methodNotAllowed()`
- `lib/api-validation.ts` — Zod schemas for request body/pagination/ID validation (`parseBody()`)
- `lib/api-helpers.ts` — `withDb()` wrapper that ensures DB initialization before route handler execution
- `hooks/` — Client-side hooks, all use `useFetch<T>` for GET and `apiPost`/`apiPatch`/`apiDelete` for mutations

### Legacy (being deprecated)

- `lib/mock-data-store.ts` — Old in-memory CRUD store
- `lib/workflow-data-store.ts` — Old in-memory workflow store

### Page structure pattern

Every page follows this layout:

```
app/<section>/
  page.tsx              ← Server Component, imports island
  <section>-client.tsx  ← "use client" component with all UI logic
  islands/
    <section>-island.tsx ← Server Component that fetches via services, passes as props
  loading.tsx           ← Suspense skeleton
  error.tsx             ← Error boundary
```

The island pattern: Server Component fetches data via services → passes to client component → client component renders interactivity.

Some sections use multiple islands (e.g., dashboard has 5: stats, workflows, heartbeat, alerts, trends). Some have dynamic routes (e.g., `app/agents/[id]/`). The `settings` page is a simpler exception with no island directory.

### API route pattern

All API routes use `success()` from `lib/api-response.ts` and return `{ success: true, data, pagination? }`. Import services from `lib/services/`, not data stores directly. Validate request bodies with `parseBody()` from `lib/api-validation.ts`.

Every route handler must be wrapped with `withDb()` from `lib/api-helpers.ts` to ensure the database is initialized:

```ts
import { withDb } from "@/lib/api-helpers";
export const GET = withDb(async (request: NextRequest) => { ... });
```

### Workflow API structure

Six workflow sub-systems under `app/api/workflows/`:

- `ai-advertising/` — keywords, analyze, optimize, export
- `ai-imaging/` — images, generate, storyboard
- `ai-listing/` — generate, bullets, categories, infringement, publish
- `competitor-ads/` — competitors, keywords, positions, analyze
- `inventory/` — restock-suggestions, restock-order, generate-suggestions
- `product-research/` — execute, keywords, data-sources, pain-points

Each has nested route files. Dynamic routes use `[id]` segments (e.g., `app/api/agents/[id]/route.ts`). The `[id]` param is extracted from `params` in the handler signature.

### Database notes

- sql.js (pure JS SQLite) with WASM — works in both Bun and Node.js
- DB file persisted to `./data/flowmind.db` (configurable via `RAK_DB_PATH` env var)
- Schema auto-created on first run, seeded if empty
- `CompatDatabase` wrapper provides bun:sqlite-compatible API

### Component library

24 Radix-based UI components in `components/ui/` following shadcn/ui patterns. Uses Tailwind CSS v4 — **no `tailwind.config.*` file**; theme is configured in `globals.css` with `@theme inline` block.

### Styling

- Dark mode default (`defaultTheme: "dark"`)
- Custom utility classes: `.glass`, `.glass-panel`, `.data-grid`, `.metric-value`
- Uses `cn()` from `lib/utils.ts` (clsx + tailwind-merge)
- Framer Motion for animations, Recharts for charts
- Tailwind v4: theme uses CSS variables mapped via `@theme inline` block in `globals.css`. Custom workflow colors: `--wf-product`, `--wf-imaging`, `--wf-ad`, `--wf-listing`, `--wf-inventory`, `--wf-competitor`. Use `text-wf-product`, `bg-wf-imaging`, etc.

### Key libraries

- `@tanstack/react-table` — Table components
- `lucide-react` — Icons
- `date-fns` — Date formatting
- `zod` v4 — Schema validation (used in `lib/api-validation.ts`)
- `recharts` v3 — Charts
- `framer-motion` v12 — Animations

### State management

Zustand for global state. `next-themes` for theme switching. Most state is managed via hooks (`hooks/use-*.ts`) and React state rather than global stores.

### Config notes

Next.js 16.2.6 with React 19. `next.config.ts` enables `cacheComponents: true`. E2E suite includes `rsc-features.spec.ts` for testing server component behavior.

### E2E tests

Playwright tests in `e2e/` — one spec file per page (agents, dashboard, evolution, memory, navigation, risk, tasks, workflows) plus `rsc-features.spec.ts` for Suspense/RSC behavior. Run `bun run test:e2e` for all, or `bun run test:e2e -- e2e/agents.spec.ts` for a single file.

### AI configuration

AI provider settings are stored in the `ai_config` table and synced from environment variables on startup. Set these in `.env.local`:

- `AI_PROVIDER` — `"mock"` | `"claude"` | `"openai"` (default: mock)
- `AI_MODEL`, `AI_BASE_URL`, `AI_API_KEY` — provider-specific config
- `AI_MAX_TOKENS`, `AI_TEMPERATURE` — generation params
- `AI_DEMO_MODE` — `"true"` to use mock data without real AI calls
