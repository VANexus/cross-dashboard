# FlowMind BFF 层设计与实现计划

> 基于 Next.js Route Handlers 的 Backend For Frontend 层
> 最终产出：可用的 API 层 + 后端接口文档

---

## 一、当前状态

- ✅ 前端 UI 全部完成（17 个路由，零错误）
- ✅ TypeScript 类型定义基本完备（`lib/types.ts`）
- ✅ Mock 数据覆盖全部页面
- ❌ 无任何 API Route（`app/api/**` 为空）
- ❌ 无数据验证层（未安装 zod）
- ❌ 无统一数据获取模式
- ❌ 6 个工作流页面有 6 个内联接口未提取到 `types.ts`

---

## 二、BFF 架构设计

### 2.1 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **API 路由** | Next.js Route Handlers (`app/api/`) | 每个模块一组路由 |
| **请求验证** | `zod` | 请求参数/响应 schema 校验 |
| **客户端获取** | 自定义 `useFetch` hook + zustand 缓存 | 统一数据获取模式 |
| **错误处理** | 统一错误响应格式 | `{ error: string; code: number; details?: any }` |
| **Mock 层** | API 路由内直接引用 mock-data | 前端开发阶段使用，后续替换为真实后端 |

### 2.2 分层架构

```
┌─────────────────────────────────────────────────────┐
│                    前端页面层                         │
│   app/workflows/*, app/agents/*, app/dashboard/*    │
├─────────────────────────────────────────────────────┤
│                  数据获取层 (hooks)                    │
│   hooks/use-agents.ts, hooks/use-tasks.ts, ...      │
├─────────────────────────────────────────────────────┤
│                    BFF API 层                        │
│   app/api/dashboard/*, app/api/agents/*, ...        │
│   + Zod 请求/响应验证                                 │
├─────────────────────────────────────────────────────┤
│                  Mock / 数据源层                      │
│   lib/mock-data.ts → (未来) 后端微服务                │
└─────────────────────────────────────────────────────┘
```

---

## 三、类型整合（Step 1）

### 3.1 提取内联接口到 `lib/types.ts`

将 6 个工作流页面中定义的内联接口统一提取：

```typescript
// 从 ai-imaging/page.tsx 提取
interface GeneratedImg {
  id: string;
  type: string;
  clipScore: number;
  ctrScore: number;
  overall: number;
  isBest: boolean;
  prompt: string;
  model: string;
  seed: number;
}

// 从 ai-advertising/page.tsx 提取
interface AdKeyword {
  id: string;
  keyword: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  acos: number;
  conversion: number;
  cpc: number;
  tag: "high-acos" | "high-conversion" | "non-precise";
  type: "SP" | "SB" | "SD";
  trend: number[];
}

// 从 inventory/page.tsx 提取
interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  stock: number;
  dailySales: number;
  ratioDays: number;
  stockoutDate: string;
  restockQty: number;
  restockDate: string;
  status: "normal" | "warning" | "caution" | "stale" | "overstock";
  trend: number[];
  avgCost: number;
  shipDays: number;
}

// 从 competitor-ads/page.tsx 提取
interface KeywordItem {
  keyword: string;
  volume: number;
  competition: number;
  type: "core" | "longtail" | "competitor";
}

interface CompetitorEntry {
  name: string;
  sp: number;
  sb: number;
  sd: number;
  coreKeywords: number;
  topPosition: number;
  targeting: "complement" | "defense" | "offense";
}

// 新增：Dashboard 数据类型（目前为内联）
interface WorkflowStatus {
  id: string;
  name: string;
  href: string;
  status: "running" | "idle" | "warning";
  lastRun: string;
  runs: number;
  success: number;
}

interface Alert {
  id: string;
  level: "danger" | "warning" | "info";
  message: string;
  time: string;
  href: string;
}

interface HealthDimension {
  label: string;
  score: number;
  value: string;
  threshold: string;
  status: "pass" | "warning";
}

interface RiskIndicator {
  name: string;
  current: string;
  threshold: string;
  status: "safe" | "warning" | "danger";
  trend: number[];
}

interface MemoryUsageStats {
  memoryId: string;
  count: number;
  trend: number[];
  created: string;
  modified: string;
  workflows: string[];
}

interface BeforeMetrics {
  accuracy: number;
  latency: number;
  coverage: number;
}

// 统一 API 响应格式
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: Pagination;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ApiError {
  success: false;
  error: string;
  code: number;
  details?: Record<string, unknown>;
}
```

### 3.2 更新工作流页面引用

将 6 个工作流页面的内联接口替换为从 `@/lib/types` 导入。

---

## 四、统一 API 响应规范（Step 2）

### 4.1 `lib/api-response.ts` — 响应工具

```typescript
import { NextResponse } from "next/server";

export function success<T>(data: T, pagination?: Pagination, status = 200) {
  return NextResponse.json({ success: true, data, pagination }, { status });
}

export function error(message: string, code = 400, details?: unknown) {
  return NextResponse.json({ success: false, error: message, code, details }, { status: code });
}

export function notFound(resource = "Resource") {
  return error(`${resource} not found`, 404);
}
```

### 4.2 `lib/api-validation.ts` — Zod schema 集中定义

```typescript
import { z } from "zod";

// 通用
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

// Tasks
export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  assignedAgents: z.array(z.string()).default([]),
});

export const updateTaskSchema = z.object({
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  output: z.string().optional(),
});

export const updateStepSchema = z.object({
  status: z.enum(["pending", "running", "completed", "failed"]).optional(),
  output: z.string().optional(),
});

// Memory
export const createMemorySchema = z.object({
  zone: z.enum(["preset", "dev", "prompt"]),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  type: z.enum(["script", "code", "prompt", "skill"]),
  tags: z.array(z.string()).default([]),
});

export const updateMemorySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  type: z.enum(["script", "code", "prompt", "skill"]).optional(),
  tags: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
});

// Risk
export const createRiskEventSchema = z.object({
  level: z.enum(["safe", "level3", "level2", "level1"]),
  title: z.string().min(1).max(200),
  description: z.string().max(1000),
  source: z.string().min(1),
  actions: z.array(z.string()).default([]),
});

export const updateRiskEventSchema = z.object({
  resolved: z.boolean().optional(),
  resolvedAt: z.string().optional(),
});

// Evolution
export const createEvolutionSchema = z.object({
  stage: z.enum(["identify", "generate", "test", "review", "reuse"]),
  title: z.string().min(1).max(200),
  description: z.string().max(1000),
  agentId: z.string().min(1),
});

export const updateEvolutionSchema = z.object({
  status: z.enum(["in_progress", "success", "failed"]).optional(),
  metrics: z.object({
    accuracy: z.number().min(0).max(100),
    latency: z.number().min(0),
    coverage: z.number().min(0).max(100),
  }).optional(),
  completedAt: z.string().optional(),
});

// Workflow: AI Advertising
export const updateAdKeywordSchema = z.object({
  cpc: z.number().min(0).optional(),
  tag: z.enum(["high-acos", "high-conversion", "non-precise"]).optional(),
});

// Workflow: AI Imaging
export const generateImageSchema = z.object({
  type: z.enum(["main", "scene", "aplus"]),
  prompt: z.string().min(1),
  model: z.string().default("stable-diffusion"),
  style: z.string().optional(),
  count: z.number().int().min(1).max(4).default(1),
});

export const updateImageSchema = z.object({
  isBest: z.boolean().optional(),
});

// Workflow: AI Listing
export const generateListingSchema = z.object({
  keyword: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  category: z.string().optional(),
  language: z.enum(["en", "ja", "de", "fr"]).default("en"),
});

export const publishListingSchema = z.object({
  title: z.string().min(1),
  bulletPoints: z.array(z.object({
    title: z.string(),
    desc: z.string(),
  })),
  description: z.string(),
  categoryId: z.string(),
  images: z.array(z.string().url()),
});

// Workflow: Product Research
export const executeResearchSchema = z.object({
  sources: z.array(z.string()).min(1),
  keywords: z.array(z.string()).optional(),
  category: z.string().optional(),
  marketplace: z.enum(["US", "UK", "DE", "JP"]).default("US"),
});

// Workflow: Inventory
export const createRestockOrderSchema = z.object({
  items: z.array(z.object({
    sku: z.string(),
    quantity: z.number().int().min(1),
    shipMethod: z.enum(["sea", "air", "express"]).default("sea"),
  })),
});

// Workflow: Competitor Ads
export const analyzeCompetitorSchema = z.object({
  asins: z.array(z.string()).min(1).max(20),
  marketplace: z.enum(["US", "UK", "DE", "JP"]).default("US"),
  keywords: z.array(z.string()).optional(),
});
```

---

## 五、API 路由文件结构（Step 3）

```
app/api/
├── dashboard/
│   └── route.ts                    → GET /api/dashboard
├── agents/
│   ├── route.ts                    → GET /api/agents
│   └── [id]/
│       └── route.ts                → GET /api/agents/:id
├── tasks/
│   ├── route.ts                    → GET/POST /api/tasks
│   └── [id]/
│       ├── route.ts                → GET/PATCH/DELETE /api/tasks/:id
│       └── steps/
│           └── [stepId]/
│               └── route.ts        → PATCH /api/tasks/:id/steps/:stepId
├── risk/
│   ├── events/
│   │   ├── route.ts                → GET/POST /api/risk/events
│   │   └── [id]/
│   │       └── route.ts            → PATCH /api/risk/events/:id
│   ├── health/
│   │   └── route.ts                → GET /api/risk/health
│   └── isolation/
│       └── route.ts                → GET/PATCH /api/risk/isolation
├── memory/
│   ├── route.ts                    → GET/POST /api/memory
│   └── [id]/
│       ├── route.ts                → GET/PUT/DELETE /api/memory/:id
│       └── usage/
│           └── route.ts            → GET /api/memory/:id/usage
├── evolution/
│   ├── route.ts                    → GET/POST /api/evolution
│   ├── [id]/
│   │   └── route.ts                → GET/PATCH /api/evolution/:id
│   └── trend/
│       └── route.ts                → GET /api/evolution/trend
└── workflows/
    ├── status/
    │   └── route.ts                → GET /api/workflows/status
    ├── product-research/
    │   ├── data-sources/
    │   │   └── route.ts            → GET /api/workflows/product-research/data-sources
    │   ├── keywords/
    │   │   └── route.ts            → GET /api/workflows/product-research/keywords
    │   ├── pain-points/
    │   │   └── route.ts            → GET /api/workflows/product-research/pain-points
    │   └── execute/
    │       └── route.ts            → POST /api/workflows/product-research/execute
    ├── ai-imaging/
    │   ├── images/
    │   │   ├── route.ts            → GET /api/workflows/ai-imaging/images
    │   │   └── [id]/
    │   │       └── route.ts        → PATCH /api/workflows/ai-imaging/images/:id
    │   ├── storyboard/
    │   │   └── route.ts            → GET /api/workflows/ai-imaging/storyboard
    │   └── generate/
    │       └── route.ts            → POST /api/workflows/ai-imaging/generate
    ├── ai-advertising/
    │   ├── keywords/
    │   │   ├── route.ts            → GET /api/workflows/ai-advertising/keywords
    │   │   └── [id]/
    │   │       └── route.ts        → PATCH /api/workflows/ai-advertising/keywords/:id
    │   └── export/
    │       └── route.ts            → POST /api/workflows/ai-advertising/export
    ├── ai-listing/
    │   ├── infringement/
    │   │   └── route.ts            → GET /api/workflows/ai-listing/infringement
    │   ├── categories/
    │   │   └── route.ts            → GET /api/workflows/ai-listing/categories
    │   ├── bullets/
    │   │   └── route.ts            → GET /api/workflows/ai-listing/bullets
    │   ├── generate/
    │   │   └── route.ts            → POST /api/workflows/ai-listing/generate
    │   └── publish/
    │       └── route.ts            → POST /api/workflows/ai-listing/publish
    ├── inventory/
    │   ├── route.ts                → GET /api/workflows/inventory
    │   ├── restock-suggestions/
    │   │   └── route.ts            → GET /api/workflows/inventory/restock-suggestions
    │   └── restock-order/
    │       └── route.ts            → POST /api/workflows/inventory/restock-order
    └── competitor-ads/
        ├── keywords/
        │   └── route.ts            → GET /api/workflows/competitor-ads/keywords
        ├── competitors/
        │   └── route.ts            → GET /api/workflows/competitor-ads/competitors
        ├── positions/
        │   └── route.ts            → GET /api/workflows/competitor-ads/positions
        └── analyze/
            └── route.ts            → POST /api/workflows/competitor-ads/analyze
```

**共计 37 个 API 端点**，覆盖全部 7 个业务痛点 + 5 个核心管理模块。

---

## 六、数据获取 Hooks（Step 4）

使用 zustand 做客户端缓存，统一封装数据获取模式：

### 6.1 `hooks/use-fetch.ts` — 通用 Hook

```typescript
import { useState, useEffect, useCallback } from "react";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface FetchOptions {
  immediate?: boolean;
}

export function useFetch<T>(url: string, options: FetchOptions = {}) {
  const { immediate = true } = options;
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  const execute = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setState({ data: json.data, loading: false, error: null });
      return json.data as T;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState({ data: null, loading: false, error: message });
      throw err;
    }
  }, [url]);

  useEffect(() => {
    if (immediate) execute();
  }, [execute, immediate]);

  return { ...state, refetch: execute };
}
```

### 6.2 各模块 Hook（共 12 个文件）

```
hooks/
├── use-fetch.ts               → 通用 fetch hook
├── use-agents.ts              → Agent 列表/详情
├── use-tasks.ts               → 任务 CRUD
├── use-risk.ts                → 风险事件/健康评分/隔离检查
├── use-memory.ts              → 记忆 CRUD/使用统计
├── use-evolution.ts           → 进化记录/趋势
├── use-dashboard.ts           → Dashboard 统计
├── use-product-research.ts    → 选品工作流
├── use-ai-imaging.ts          → AI 作图工作流
├── use-ai-advertising.ts      → AI 广告工作流
├── use-ai-listing.ts          → AI 上架工作流
├── use-inventory.ts           → 库销比工作流
└── use-competitor-ads.ts      → 竞品广告工作流
```

---

## 七、后端接口文档（Step 5 — 最终产出）

生成完整的 `docs/api-reference.md`，包含所有 37 个端点的详细规格，供后端开发团队使用。

---

## 八、实施步骤清单

| Step | 操作 | 产出文件 |
|------|------|---------|
| 1 | 安装 zod | `package.json` |
| 2 | 整合类型定义 | `lib/types.ts`（更新） |
| 3 | 创建统一响应工具 | `lib/api-response.ts`（新建） |
| 4 | 创建 Zod schema 验证 | `lib/api-validation.ts`（新建） |
| 5 | 创建通用 fetch hook | `hooks/use-fetch.ts`（新建） |
| 6 | Dashboard API + Hook | `app/api/dashboard/route.ts` + `hooks/use-dashboard.ts` |
| 7 | Agents API + Hook | `app/api/agents/` (2个路由) + `hooks/use-agents.ts` |
| 8 | Tasks API + Hook | `app/api/tasks/` (3个路由) + `hooks/use-tasks.ts` |
| 9 | Risk API + Hook | `app/api/risk/` (3个路由) + `hooks/use-risk.ts` |
| 10 | Memory API + Hook | `app/api/memory/` (2个路由) + `hooks/use-memory.ts` |
| 11 | Evolution API + Hook | `app/api/evolution/` (2个路由) + `hooks/use-evolution.ts` |
| 12 | Workflow APIs (6个) + Hooks | `app/api/workflows/` (21个路由) + 6 个 hooks |
| 13 | 生成 API 文档 | `docs/api-reference.md` |
| 14 | pnpm build 验证 | 构建通过 |

---

## 九、每个 API 端点详细规格

### 9.1 Dashboard

| 方法 | 端点 | 说明 | 查询参数 | 响应类型 |
|------|------|------|---------|---------|
| GET | `/api/dashboard` | 仪表盘全量数据 | — | `DashboardStats & BusinessMetrics & { workflows: WorkflowStatus[]; alerts: Alert[]; trends: { sales: number[]; acos: number[]; conversion: number[] } }` |

### 9.2 Agents

| 方法 | 端点 | 说明 | 查询参数 | 响应类型 |
|------|------|------|---------|---------|
| GET | `/api/agents` | Agent 列表 | `status?`, `type?` | `Agent[]` |
| GET | `/api/agents/[id]` | Agent 详情 | — | `Agent & { subAgents: SubAgent[] }` |

### 9.3 Tasks

| 方法 | 端点 | 说明 | 查询参数 / 请求体 | 响应类型 |
|------|------|------|---------|---------|
| GET | `/api/tasks` | 任务列表 | `status?`, `priority?`, `page?`, `pageSize?` | `Task[]` + 分页 |
| POST | `/api/tasks` | 创建任务 | `CreateTaskSchema` | `Task` |
| GET | `/api/tasks/[id]` | 任务详情 | — | `Task` (含 steps) |
| PATCH | `/api/tasks/[id]` | 更新任务 | `UpdateTaskSchema` | `Task` |
| DELETE | `/api/tasks/[id]` | 删除任务 | — | `{ id: string }` |
| PATCH | `/api/tasks/[id]/steps/[stepId]` | 更新步骤 | `UpdateStepSchema` | `TaskStep` |

### 9.4 Risk

| 方法 | 端点 | 说明 | 查询参数 / 请求体 | 响应类型 |
|------|------|------|---------|---------|
| GET | `/api/risk/health` | 健康评分 | — | `{ score: number; dimensions: HealthDimension[]; indicators: RiskIndicator[] }` |
| GET | `/api/risk/events` | 风险事件 | `level?`, `resolved?`, `page?`, `pageSize?` | `RiskEvent[]` + 分页 |
| POST | `/api/risk/events` | 新增事件 | `CreateRiskEventSchema` | `RiskEvent` |
| PATCH | `/api/risk/events/[id]` | 更新事件 | `UpdateRiskEventSchema` | `RiskEvent` |
| GET | `/api/risk/isolation` | 隔离检查清单 | — | `{ items: IsolationItem[] }` |
| PATCH | `/api/risk/isolation` | 更新隔离项 | `{ index: number; checked: boolean }` | `{ items: IsolationItem[] }` |

### 9.5 Memory

| 方法 | 端点 | 说明 | 查询参数 / 请求体 | 响应类型 |
|------|------|------|---------|---------|
| GET | `/api/memory` | 记忆列表 | `zone?`, `type?`, `search?`, `page?`, `pageSize?` | `MemoryEntry[]` + 分页 |
| POST | `/api/memory` | 新增记忆 | `CreateMemorySchema` | `MemoryEntry` |
| GET | `/api/memory/[id]` | 记忆详情 | — | `MemoryEntry` |
| PUT | `/api/memory/[id]` | 更新记忆 | `UpdateMemorySchema` | `MemoryEntry` |
| DELETE | `/api/memory/[id]` | 删除记忆 | — | `{ id: string }` |
| GET | `/api/memory/[id]/usage` | 使用统计 | — | `MemoryUsageStats` |

### 9.6 Evolution

| 方法 | 端点 | 说明 | 查询参数 / 请求体 | 响应类型 |
|------|------|------|---------|---------|
| GET | `/api/evolution` | 进化记录 | `stage?`, `status?`, `page?`, `pageSize?` | `EvolutionRecord[]` + 分页 |
| POST | `/api/evolution` | 创建项目 | `CreateEvolutionSchema` | `EvolutionRecord` |
| GET | `/api/evolution/[id]` | 记录详情 | — | `EvolutionRecord & { beforeMetrics?: BeforeMetrics }` |
| PATCH | `/api/evolution/[id]` | 更新记录 | `UpdateEvolutionSchema` | `EvolutionRecord` |
| GET | `/api/evolution/trend` | 进化趋势 | `months?` (默认6) | `{ labels: string[]; data: number[] }` |

### 9.7 Workflows — 选品

| 方法 | 端点 | 说明 | 查询参数 / 请求体 | 响应类型 |
|------|------|------|---------|---------|
| GET | `/api/workflows/status` | 全部工作流状态 | — | `WorkflowStatus[]` |
| GET | `/api/workflows/product-research/data-sources` | 数据源状态 | — | `DataSource[]` |
| GET | `/api/workflows/product-research/keywords` | 关键词分析 | `marketplace?` | `ProductKeyword[]` |
| GET | `/api/workflows/product-research/pain-points` | 差评痛点 | `asin?` | `PainPoint[]` |
| POST | `/api/workflows/product-research/execute` | 触发采集 | `ExecuteResearchSchema` | `Task` |

### 9.8 Workflows — AI 作图

| 方法 | 端点 | 说明 | 查询参数 / 请求体 | 响应类型 |
|------|------|------|---------|---------|
| GET | `/api/workflows/ai-imaging/images` | 图片列表 | `type?` (main/scene/aplus) | `GeneratedImg[]` |
| PATCH | `/api/workflows/ai-imaging/images/[id]` | 更新图片 | `UpdateImageSchema` | `GeneratedImg` |
| GET | `/api/workflows/ai-imaging/storyboard` | 分镜数据 | — | `StoryboardFrame[]` |
| POST | `/api/workflows/ai-imaging/generate` | 触发生成 | `GenerateImageSchema` | `Task` |

### 9.9 Workflows — AI 广告

| 方法 | 端点 | 说明 | 查询参数 / 请求体 | 响应类型 |
|------|------|------|---------|---------|
| GET | `/api/workflows/ai-advertising/keywords` | 关键词数据 | `type?`, `tag?` | `AdKeyword[]` |
| PATCH | `/api/workflows/ai-advertising/keywords/[id]` | 调整出价 | `UpdateAdKeywordSchema` | `AdKeyword` |
| POST | `/api/workflows/ai-advertising/export` | 导出报告 | `{ format: "csv" \| "xlsx" }` | `{ url: string }` |

### 9.10 Workflows — AI 上架

| 方法 | 端点 | 说明 | 查询参数 / 请求体 | 响应类型 |
|------|------|------|---------|---------|
| GET | `/api/workflows/ai-listing/infringement` | 侵权检测 | `keyword?` | `InfringementWord[]` |
| GET | `/api/workflows/ai-listing/categories` | 类目推荐 | `keyword?` | `CategoryRec[]` |
| GET | `/api/workflows/ai-listing/bullets` | 卖点文案 | `keyword?` | `BulletPoint[]` |
| POST | `/api/workflows/ai-listing/generate` | 触发生成 | `GenerateListingSchema` | `Task` |
| POST | `/api/workflows/ai-listing/publish` | 一键上架 | `PublishListingSchema` | `{ success: boolean; listingId?: string }` |

### 9.11 Workflows — 库销比

| 方法 | 端点 | 说明 | 查询参数 / 请求体 | 响应类型 |
|------|------|------|---------|---------|
| GET | `/api/workflows/inventory` | 库存列表 | `status?`, `page?`, `pageSize?` | `InventoryItem[]` + 分页 |
| GET | `/api/workflows/inventory/restock-suggestions` | 补货建议 | — | `RestockSuggestion[]` |
| POST | `/api/workflows/inventory/restock-order` | 创建补货单 | `CreateRestockOrderSchema` | `Task` |

### 9.12 Workflows — 竞品广告

| 方法 | 端点 | 说明 | 查询参数 / 请求体 | 响应类型 |
|------|------|------|---------|---------|
| GET | `/api/workflows/competitor-ads/keywords` | 关键词分析 | `type?` | `KeywordItem[]` |
| GET | `/api/workflows/competitor-ads/competitors` | 竞品策略 | — | `CompetitorEntry[]` |
| GET | `/api/workflows/competitor-ads/positions` | 广告位分布 | — | `AdPosition[]` |
| POST | `/api/workflows/competitor-ads/analyze` | 触发分析 | `AnalyzeCompetitorSchema` | `Task` |

---

## 十、文件清单

| 操作 | 文件 | 类型 |
|------|------|------|
| 安装 | `zod` | 依赖 |
| 更新 | `lib/types.ts` | 类型整合 |
| 新建 | `lib/api-response.ts` | API 响应工具 |
| 新建 | `lib/api-validation.ts` | Zod schema |
| 新建 | `lib/mock-data-store.ts` | 可写 mock 数据层 |
| 新建 | `hooks/use-fetch.ts` | 通用 hook |
| 新建 | `hooks/use-agents.ts` | 模块 hook |
| 新建 | `hooks/use-tasks.ts` | 模块 hook |
| 新建 | `hooks/use-risk.ts` | 模块 hook |
| 新建 | `hooks/use-memory.ts` | 模块 hook |
| 新建 | `hooks/use-evolution.ts` | 模块 hook |
| 新建 | `hooks/use-dashboard.ts` | 模块 hook |
| 新建 | `hooks/use-product-research.ts` | 模块 hook |
| 新建 | `hooks/use-ai-imaging.ts` | 模块 hook |
| 新建 | `hooks/use-ai-advertising.ts` | 模块 hook |
| 新建 | `hooks/use-ai-listing.ts` | 模块 hook |
| 新建 | `hooks/use-inventory.ts` | 模块 hook |
| 新建 | `hooks/use-competitor-ads.ts` | 模块 hook |
| 新建 | `app/api/dashboard/route.ts` | 1 个端点 |
| 新建 | `app/api/agents/route.ts` | 1 个端点 |
| 新建 | `app/api/agents/[id]/route.ts` | 1 个端点 |
| 新建 | `app/api/tasks/route.ts` | 2 个端点 |
| 新建 | `app/api/tasks/[id]/route.ts` | 3 个端点 |
| 新建 | `app/api/tasks/[id]/steps/[stepId]/route.ts` | 1 个端点 |
| 新建 | `app/api/risk/health/route.ts` | 1 个端点 |
| 新建 | `app/api/risk/events/route.ts` | 2 个端点 |
| 新建 | `app/api/risk/events/[id]/route.ts` | 1 个端点 |
| 新建 | `app/api/risk/isolation/route.ts` | 2 个端点 |
| 新建 | `app/api/memory/route.ts` | 2 个端点 |
| 新建 | `app/api/memory/[id]/route.ts` | 3 个端点 |
| 新建 | `app/api/memory/[id]/usage/route.ts` | 1 个端点 |
| 新建 | `app/api/evolution/route.ts` | 2 个端点 |
| 新建 | `app/api/evolution/[id]/route.ts` | 2 个端点 |
| 新建 | `app/api/evolution/trend/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/status/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/product-research/data-sources/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/product-research/keywords/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/product-research/pain-points/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/product-research/execute/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/ai-imaging/images/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/ai-imaging/images/[id]/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/ai-imaging/storyboard/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/ai-imaging/generate/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/ai-advertising/keywords/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/ai-advertising/keywords/[id]/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/ai-advertising/export/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/ai-listing/infringement/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/ai-listing/categories/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/ai-listing/bullets/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/ai-listing/generate/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/ai-listing/publish/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/inventory/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/inventory/restock-suggestions/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/inventory/restock-order/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/competitor-ads/keywords/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/competitor-ads/competitors/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/competitor-ads/positions/route.ts` | 1 个端点 |
| 新建 | `app/api/workflows/competitor-ads/analyze/route.ts` | 1 个端点 |
| 新建 | `docs/api-reference.md` | 后端接口文档 |

**总计: ~58 个文件操作（安装 + 新建/更新）**
