# FlowMind 端到端测试 & Python 后端迁移计划（更新版）

## 问题诊断

### Bug 1: Dashboard 数据结构不匹配 — ✅ 已修复

* `dashboard-client.tsx` 已重写，匹配实际 API 返回结构

### Bug 2: RSC 页面 fetch 失败

* RSC 页面使用 `process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"` 构造 fetch URL

* 没有 `.env.local` 文件

* **方案**: 用 Python FastAPI 后端替代 Next.js mock-data-store，API route 做代理转发，RSC 页面继续调 Next.js API route（由 Next.js API route 转发到 Python 后端）

## 整体架构

```
RSC page.tsx ──fetch──▶ Next.js API route ──fetch──▶ Python FastAPI :8000
    │                       │                              │
    │ (Suspense/streaming)  │ (backend-client.ts)          │ (mock_data.py)
    ▼                       ▼                              ▼
DashboardClient         {success,data,pagination}       内存数据存储
```

***

## Step 1: 构建 Python FastAPI 测试后端

**目录**: `d:\dev\backend`

### 1.1 安装依赖

```bash
cd d:\dev\backend && uv add fastapi uvicorn[standard]
```

### 1.2 文件结构

```
backend/
├── main.py              # FastAPI 入口 + CORS + 路由注册
├── models.py            # Pydantic 模型（对应 lib/types.ts）
├── mock_data.py         # 内存数据存储（从 mock-data.ts + workflow-data-store.ts 迁移）
└── routers/
    ├── __init__.py
    ├── dashboard.py     # GET /api/dashboard
    ├── agents.py        # GET /api/agents, GET /api/agents/{id}
    ├── tasks.py         # CRUD /api/tasks, /api/tasks/{id}, /api/tasks/{id}/steps/{stepId}
    ├── risk.py          # CRUD /api/risk/events, GET /api/risk/health, /api/risk/isolation
    ├── memory.py        # CRUD /api/memory, /api/memory/{id}, /api/memory/{id}/usage
    ├── evolution.py     # CRUD /api/evolution, /api/evolution/{id}, /api/evolution/trend
    └── workflows.py     # 所有 workflow 端点（~23 个）
```

### 1.3 API 端点完整清单（匹配 40 个 Next.js API route）

| #  | Python 端点                                      | 方法     | 对应 Next.js route                             |
| -- | ---------------------------------------------- | ------ | -------------------------------------------- |
| 1  | `/api/dashboard`                               | GET    | `app/api/dashboard/route.ts`                 |
| 2  | `/api/agents`                                  | GET    | `app/api/agents/route.ts`                    |
| 3  | `/api/agents/{id}`                             | GET    | `app/api/agents/[id]/route.ts`               |
| 4  | `/api/tasks`                                   | GET    | `app/api/tasks/route.ts`                     |
| 5  | `/api/tasks`                                   | POST   | `app/api/tasks/route.ts`                     |
| 6  | `/api/tasks/{id}`                              | GET    | `app/api/tasks/[id]/route.ts`                |
| 7  | `/api/tasks/{id}`                              | PATCH  | `app/api/tasks/[id]/route.ts`                |
| 8  | `/api/tasks/{id}`                              | DELETE | `app/api/tasks/[id]/route.ts`                |
| 9  | `/api/tasks/{id}/steps/{stepId}`               | PATCH  | `app/api/tasks/[id]/steps/[stepId]/route.ts` |
| 10 | `/api/risk/events`                             | GET    | `app/api/risk/events/route.ts`               |
| 11 | `/api/risk/events`                             | POST   | `app/api/risk/events/route.ts`               |
| 12 | `/api/risk/events/{id}`                        | PATCH  | `app/api/risk/events/[id]/route.ts`          |
| 13 | `/api/risk/health`                             | GET    | `app/api/risk/health/route.ts`               |
| 14 | `/api/risk/isolation`                          | GET    | `app/api/risk/isolation/route.ts`            |
| 15 | `/api/risk/isolation`                          | PATCH  | `app/api/risk/isolation/route.ts`            |
| 16 | `/api/memory`                                  | GET    | `app/api/memory/route.ts`                    |
| 17 | `/api/memory`                                  | POST   | `app/api/memory/route.ts`                    |
| 18 | `/api/memory/{id}`                             | GET    | `app/api/memory/[id]/route.ts`               |
| 19 | `/api/memory/{id}`                             | PUT    | `app/api/memory/[id]/route.ts`               |
| 20 | `/api/memory/{id}`                             | DELETE | `app/api/memory/[id]/route.ts`               |
| 21 | `/api/memory/{id}/usage`                       | GET    | `app/api/memory/[id]/usage/route.ts`         |
| 22 | `/api/evolution`                               | GET    | `app/api/evolution/route.ts`                 |
| 23 | `/api/evolution`                               | POST   | `app/api/evolution/route.ts`                 |
| 24 | `/api/evolution/{id}`                          | GET    | `app/api/evolution/[id]/route.ts`            |
| 25 | `/api/evolution/{id}`                          | PATCH  | `app/api/evolution/[id]/route.ts`            |
| 26 | `/api/evolution/trend`                         | GET    | `app/api/evolution/trend/route.ts`           |
| 27 | `/api/workflows/status`                        | GET    | `app/api/workflows/status/route.ts`          |
| 28 | `/api/workflows/product-research/data-sources` | GET    | 4 files                                      |
| 29 | `/api/workflows/product-research/keywords`     | GET    | <br />                                       |
| 30 | `/api/workflows/product-research/pain-points`  | GET    | <br />                                       |
| 31 | `/api/workflows/product-research/execute`      | POST   | <br />                                       |
| 32 | `/api/workflows/ai-imaging/images`             | GET    | 4 files                                      |
| 33 | `/api/workflows/ai-imaging/images/{id}`        | PATCH  | <br />                                       |
| 34 | `/api/workflows/ai-imaging/storyboard`         | GET    | <br />                                       |
| 35 | `/api/workflows/ai-imaging/generate`           | POST   | <br />                                       |
| 36 | `/api/workflows/ai-advertising/keywords`       | GET    | 3 files                                      |
| 37 | `/api/workflows/ai-advertising/keywords/{id}`  | PATCH  | <br />                                       |
| 38 | `/api/workflows/ai-advertising/export`         | POST   | <br />                                       |
| 39 | `/api/workflows/ai-listing/infringement`       | GET    | 5 files                                      |
| 40 | `/api/workflows/ai-listing/categories`         | GET    | <br />                                       |
| 41 | `/api/workflows/ai-listing/bullets`            | GET    | <br />                                       |
| 42 | `/api/workflows/ai-listing/generate`           | POST   | <br />                                       |
| 43 | `/api/workflows/ai-listing/publish`            | POST   | <br />                                       |
| 44 | `/api/workflows/inventory`                     | GET    | 3 files                                      |
| 45 | `/api/workflows/inventory/restock-suggestions` | GET    | <br />                                       |
| 46 | `/api/workflows/inventory/restock-order`       | POST   | <br />                                       |
| 47 | `/api/workflows/competitor-ads/keywords`       | GET    | 4 files                                      |
| 48 | `/api/workflows/competitor-ads/competitors`    | GET    | <br />                                       |
| 49 | `/api/workflows/competitor-ads/positions`      | GET    | <br />                                       |
| 50 | `/api/workflows/competitor-ads/analyze`        | POST   | <br />                                       |

### 1.4 数据迁移要点

* `mock_data.py` 将所有 TypeScript 静态数据翻译为 Python dict/list

* 使用 `dict.copy()` 保证每次请求返回新副本

* 分页逻辑与 `mock-data-store.ts` 完全一致：`page`, `pageSize`, `total`, `totalPages`

* 筛选逻辑完全复刻

* 统一响应格式：`{"success": true, "data": ..., "pagination": {...}}`

***

## Step 2: 创建 `lib/backend-client.ts` + 更新 40 个 API route 代理

### 2.1 创建 `lib/backend-client.ts`

```typescript
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function backendGet(path: string, searchParams?: Record<string, string>) {
  const url = new URL(`${BACKEND_URL}${path}`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  return res.json();
}

export async function backendPost(path: string, body: unknown) { ... }
export async function backendPatch(path: string, body: unknown) { ... }
export async function backendPut(path: string, body: unknown) { ... }
export async function backendDelete(path: string) { ... }
```

### 2.2 更新每个 API route handler

每个 route.ts 将从：

```typescript
import { getAgents } from "@/lib/mock-data-store";
export async function GET(request) {
  const data = getAgents(filters);
  return success(data);
}
```

改为：

```typescript
import { backendGet } from "@/lib/backend-client";
import { NextResponse } from "next/server";
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const data = await backendGet("/api/agents", Object.fromEntries(searchParams));
  return NextResponse.json(data);
}
```

**影响范围**：40 个 `route.ts` 文件全部更新

***

## Step 3: 创建 `.env.local`

**文件**: `d:\dev\.env.local`

```
BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

***

## Step 4: 安装 Playwright + 编写端到端测试

### 4.1 Playwright 配置

```typescript
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: [
    {
      command: "cd backend && uv run uvicorn main:app --port 8000",
      port: 8000,
      reuseExistingServer: true,
    },
    {
      command: "pnpm dev",
      port: 3000,
      reuseExistingServer: true,
    },
  ],
});
```

### 4.2 测试文件清单（9 个 spec）

| # | 文件                         | 测试内容                                                              |
| - | -------------------------- | ----------------------------------------------------------------- |
| 1 | `e2e/dashboard.spec.ts`    | Dashboard 全链路：Suspense 骨架屏 → 数据渲染，统计卡片、工作流表格、告警列表、趋势 Sparkline    |
| 2 | `e2e/agents.spec.ts`       | Agent 列表卡片网格，点击进入详情（动态路由 `[id]`），状态指示器                            |
| 3 | `e2e/tasks.spec.ts`        | 任务列表、搜索过滤、状态筛选、列表/网格切换、任务详情步骤时间线                                  |
| 4 | `e2e/risk.spec.ts`         | 健康评分环形图、风险事件列表、展开/折叠、隔离清单勾选                                       |
| 5 | `e2e/memory.spec.ts`       | 记忆条目列表、类型/区域筛选、搜索、使用统计                                            |
| 6 | `e2e/evolution.spec.ts`    | 进化记录列表、阶段/状态筛选、趋势图、展开详情 metrics                                   |
| 7 | `e2e/workflows.spec.ts`    | 6 个工作流页面独立加载、动态导入组件、交互功能                                          |
| 8 | `e2e/navigation.spec.ts`   | 侧边栏导航所有页面、404 测试                                                  |
| 9 | `e2e/rsc-features.spec.ts` | 流式渲染 Suspense fallback → 内容替换、loading.tsx 骨架屏、动态路由参数传递、错误边界 reset |

### 4.3 关键测试验证点

**RSC 特性验证**：

* Suspense 流式渲染：先出现 skeleton → 后出现真实数据

* loading.tsx 骨架屏：页面加载时可见 `.skeleton` 类元素

* 动态路由：`/agents/sentinel-001` 正确渲染 Agent 详情

* error.tsx：触发错误时显示错误 UI 和重试按钮

* next/dynamic `{ ssr: false }`：AnimatedNumber、Sparkline 在客户端渲染

**数据完整性验证**：

* 所有数据来自 Python 后端（非前端硬编码）

* Dashboard 统计数值与后端数据一致

* 分页功能正确

* 筛选/搜索功能正确

***

## Step 5: 运行测试 + 修复问题

1. `pnpm exec playwright install chromium`
2. `pnpm exec playwright test`
3. 修复发现的问题
4. 确保所有测试通过

***

## 启动方式

```bash
# 终端 1: Python 后端
cd d:\dev\backend && uv run uvicorn main:app --port 8000 --reload

# 终端 2: Next.js 前端
cd d:\dev && pnpm dev

# 终端 3: 运行测试
cd d:\dev && pnpm exec playwright test
```

