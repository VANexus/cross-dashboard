# CLAUDE.md — Claude Code 开发指南

> 本文件为 Claude Code (claude.ai/code) 提供 cross-dashboard 项目的开发指引。

## 常用命令

| 任务 | 命令 |
|------|------|
| 开发服务器 | `bun run dev` |
| 生产构建 | `bun run build` |
| 启动生产 | `bun run start` |
| 代码检查 | `bun run lint` |
| E2E 测试 | `bun run test:e2e` |
| 单个测试 | `bun run test:e2e -- path/to/test.spec.ts` |
| 列出测试 | `bun run test:e2e:list` |

包管理器是 **Bun**（不是 npm/pnpm/yarn）。没有单元测试，只有 Playwright E2E 测试（`e2e/`）。

## ⚠️ 这不是你熟悉的 Next.js

本项目使用 Next.js 16.2.6，有破坏性变更——API、约定和文件结构可能与你的训练数据不同。编写代码前**必须**阅读 `node_modules/next/dist/docs/` 中的指南。注意弃用通知。

## 项目概述

**FlowMind** — 跨境电商智能编排系统（跨境电商智能编排系统）。UI 全部为中文（zh-CN）。

系统通过 RAK 协议引擎协调多个自主智能体，实现选品、AI 制图、广告优化、商品发布、库存管理、竞品分析六大工作流的自动化编排。

## 分层架构

```
API Routes (app/api/)  ←→  Services (lib/services/)  ←→  Repositories (lib/repositories/)  ←→  SQLite (lib/db/)
                                                       ↕
                                                  RAK Engine (lib/rak/)
                                                       ↕
                                                  AI Providers (lib/ai/)
                                                  Agent Runtime (lib/agent-runtime/)
```

## 数据流（双路径）

1. **客户端**：React 组件 → hooks (`hooks/use-*.ts`) → `fetch('/api/...')` → API Route Handler → Service → Repository → SQLite
2. **服务端 (SSR)**：Island 组件 (`islands/*-island.tsx`) → Service → Repository → SQLite → 作为 props 传递给客户端组件

两条路径共享同一个 SQLite 数据库（sql.js，存储在 `./data/flowmind.db`）。

## ⚠️ 核心数据约定

- **Repository 读写 JSON**：schema 把数组/嵌套对象存成 TEXT 列（如 `assigned_agents TEXT DEFAULT '[]'`）。每个 Repository 写入时必须 `JSON.stringify()`，读取时用 `parseJsonField()`（`lib/repositories/base.ts`）。列表端点统一用 `paginatedQuery()`，返回 `{ items, pagination: { page, pageSize, total, totalPages } }`。
- **API 响应 envelope**：所有 API 路由用 `lib/api-response.ts` 的 `success()` 返回 `{ success: true, data, pagination? }`；失败用 `error()/notFound()/badRequest()/methodNotAllowed()`。
- **Island vs API 数据形态不同**：Island（SSR）直接调 service 并把结果作为 props 传给客户端组件，**不过 HTTP、无 envelope**；客户端组件若要实时刷新再走 `useFetch` 打到对应 API（同样是 `{success, data}`）。两者互补，别在一处用错数据形态。
- **AI Provider 热切换**：`getAIProvider()` 每次从 `ai_config` 表读配置，仅当配置快照变化才重建 provider（`lib/ai/index.ts`），所以 Settings 改配置可即时生效、无需重启。
- **demo_mode 决定「真脑 / 假脑」**：`AI_DEMO_MODE=true`（或 `ai_config` 里 `demo_mode`）时，Agent 生命周期用模板驱动的 `DemoAgentBrain`；否则用 `RealAgentBrain` 调 LLM。改这个开关即可切换（`lib/agent-runtime/real-brain.ts` / `demo-brain.ts`）。

## 关键目录

| 目录 | 说明 |
|------|------|
| `lib/db/` | 数据库单例（sql.js WASM），schema、迁移、种子数据。用 `getDbAsync()` 初始化，`getDb()` 同步访问 |
| `lib/repositories/` | 数据访问层。每个实体一个 Repository（agent、task、risk、memory、evolution、workflow、rak）。列表端点使用 `paginatedQuery()` |
| `lib/services/` | 业务逻辑层。纯类，按需实例化 |
| `lib/rak/` | RAK 协议引擎（coordinator、mesh executor、conflict resolver、consensus） |
| `lib/ai/` | AI Provider 适配器（Claude、OpenAI、mock）。通过适配器模式实现 Provider 无关 |
| `lib/agent-runtime/` | Agent 自主运行时（生命周期、情绪状态机、决策循环、日志、事件总线） |
| `lib/ziniao/` | 紫鸟浏览器桥接客户端 |
| `lib/crawlers/` | 爬虫实现 |
| `lib/image-gen/` | 图片生成 |
| `lib/types.ts` | 所有共享 TypeScript 接口 |
| `lib/api-response.ts` | 标准化响应辅助函数：`success()`、`error()`、`notFound()`、`badRequest()`、`methodNotAllowed()` |
| `lib/api-validation.ts` | Zod schema 验证（`parseBody()`） |
| `lib/api-helpers.ts` | `withDb()` 包装器，确保路由执行前数据库已初始化 |
| `hooks/` | 客户端 hooks，全部基于 `useFetch<T>` 做 GET，`apiPost`/`apiPatch`/`apiDelete` 做变更 |

## 遗留代码（逐步废弃，可安全删除）

- `lib/mock-data-store.ts` — 旧内存 CRUD 存储，**已无任何引用**（种子数据已迁入 `lib/db/seed.ts`）
- `lib/workflow-data-store.ts` — 旧内存工作流存储，同上
- `lib/mock-data.ts` — 旧种子源数据（`seed.ts` 已由它迁移而来，仅 legacy store 引用）

## 页面结构模式

每个页面遵循以下布局：

```
app/<section>/
  page.tsx              ← Server Component，导入 island
  <section>-client.tsx  ← "use client" 组件，包含所有 UI 逻辑
  islands/
    <section>-island.tsx ← Server Component，通过 service 获取数据，传递 props 给 client 组件
  loading.tsx           ← Suspense 骨架屏
  error.tsx             ← 错误边界
```

Island 模式：Server Component 通过 service 获取数据 → 传递给 client component → client component 渲染交互。

部分页面使用多个 Island（如 dashboard 有 5 个：stats、workflows、heartbeat、alerts、trends）。部分有动态路由（如 `app/agents/[id]/`）。`settings` 页面较简单，没有 island 目录。

## API 路由模式

所有 API 路由使用 `lib/api-response.ts` 中的 `success()` 返回 `{ success: true, data, pagination? }`。从 `lib/services/` 导入 service，不要直接访问 data store。使用 `lib/api-validation.ts` 中的 `parseBody()` 验证请求体。

每个路由处理器必须使用 `withDb()` 包装：

```typescript
import { withDb } from "@/lib/api-helpers";
export const GET = withDb(async (request: NextRequest) => { ... });
```

## 六大工作流 API

`app/api/workflows/` 下的六个子系统：

| 工作流 | API 子路由 |
|--------|-----------|
| `ai-advertising/` | keywords, analyze, optimize, export |
| `ai-imaging/` | images, generate, storyboard |
| `ai-listing/` | generate, bullets, categories, infringement, publish |
| `competitor-ads/` | competitors, keywords, positions, analyze |
| `inventory/` | restock-suggestions, restock-order, generate-suggestions |
| `product-research/` | execute, keywords, data-sources, pain-points |

动态路由使用 `[id]` 段（如 `app/api/agents/[id]/route.ts`）。`[id]` 参数从 handler 签名的 `params` 中提取。

## 数据库

- sql.js（纯 JS SQLite）+ WASM — 在 Bun 和 Node.js 中均可工作
- 数据文件持久化到 `./data/flowmind.db`（通过 `RAK_DB_PATH` 环境变量配置）
- 首次运行自动建表，空库时自动填充种子数据
- `CompatDatabase` 封装提供 bun:sqlite 兼容 API
- 轻量级迁移在 `lib/db/index.ts` 中（ALTER TABLE / CREATE TABLE IF NOT EXISTS）

## 组件库

`components/ui/` 中有 24 个基于 Radix UI 的组件，遵循 shadcn/ui 模式。

## 样式

- Tailwind CSS v4 — **没有 `tailwind.config.*` 文件**，主题在 `globals.css` 中通过 `@theme inline` 块配置
- 自定义工具类：`.glass`、`.glass-panel`、`.data-grid`、`.metric-value`
- 使用 `cn()`（clsx + tailwind-merge）
- Framer Motion 动画，Recharts 图表
- 工作流颜色：`--wf-product`、`--wf-imaging`、`--wf-ad`、`--wf-listing`、`--wf-inventory`、`--wf-competitor`。使用 `text-wf-product`、`bg-wf-imaging` 等

## 关键依赖

| 库 | 用途 |
|----|------|
| `@tanstack/react-table` | 表格组件 |
| `lucide-react` | 图标 |
| `date-fns` | 日期格式化 |
| `zod` v4 | Schema 验证（`lib/api-validation.ts`） |
| `recharts` v3 | 图表 |
| `framer-motion` v12 | 动画 |
| `sql.js` | SQLite WASM |
| `zustand` v5 | 全局状态 |
| `next-themes` | 主题切换 |

## 状态管理

Zustand 用于全局状态。`next-themes` 用于主题切换。大部分状态通过 hooks（`hooks/use-*.ts`）和 React state 管理，而非全局 store。

## Hooks 约定

客户端数据获取统一基于 `useFetch<T>`（GET，返回 `{ data, loading, error, refetch }`）与 `apiGet/apiPost/apiPatch/apiPut/apiDelete`（变更）；领域 hook 在其上封装并拼 `URLSearchParams`。这些函数假定 API 返回 `{success, data}`，`!success` 时抛错。

## 配置说明

- Next.js 16.2.6 + React 19
- `next.config.ts` 启用 `cacheComponents: true`
- E2E 套件包含 `rsc-features.spec.ts` 测试 Server Component 行为

## E2E 测试

Playwright 测试在 `e2e/` 中，每个页面一个 spec 文件（agents、dashboard、evolution、memory、navigation、risk、tasks、workflows），加上 `rsc-features.spec.ts` 测试 Suspense/RSC 行为。

运行 `bun run test:e2e` 执行全部，或 `bun run test:e2e -- e2e/agents.spec.ts` 执行单个文件。

## AI 配置

AI Provider 设置存储在 `ai_config` 表中，启动时从环境变量同步。在 `.env.local` 中设置：

| 变量 | 说明 |
|------|------|
| `AI_PROVIDER` | `"mock"` / `"claude"` / `"openai"`（默认 mock） |
| `AI_MODEL` | 模型名称 |
| `AI_BASE_URL` | API 地址 |
| `AI_API_KEY` | API 密钥 |
| `AI_MAX_TOKENS` | 最大 token 数 |
| `AI_TEMPERATURE` | 温度参数 |
| `AI_DEMO_MODE` | `"true"` 使用模拟数据 |

## Agent 生命系统

Agent 具有自主运行时（`lib/agent-runtime/`），数据库初始化时自动启动：

- **情绪状态机**：6 种状态（focused / alert / tired / stressed / curious / satisfied）
- **决策循环**：wake → context → think → journal → decide → mood → emit
- **人格配置**：系统提示词、沟通风格、专业领域
- **目标追踪**：带优先级和进度
- **日志系统**：thought / decision / observation / reflection 四种类型
- **事件总线**：进程内事件分发
- **自主循环**：每个 Agent 一个 `setInterval`（带 ±20% 抖动防同频），DB 初始化后自动启动
- **实时 SSE**：客户端用原生 `EventSource` 打 `/api/agents/[id]/stream` 订阅事件总线。注意该路由的订阅清理依赖 GC，客户端断开后订阅可能短暂残留（`app/api/agents/[id]/stream/route.ts`）

## RAK 引擎

`lib/rak/`（coordinator / mesh）。Coordinator 负责 Agent 注册表与持久化消息路由（`rak_messages` 表），MeshExecutor 负责 DAG 编排（拓扑分层并行执行）。真实的编排效果经由 `TaskService` 的 `create/update`（建 DAG + 调度）体现。

## 紫鸟浏览器桥接

爬虫中心通过 `lib/ziniao/client.ts` 连接本地紫鸟防关联浏览器（默认 `http://127.0.0.1:9481`）。API Key 通过 `ZCLAW_API_KEY` 环境变量或 `~/.zclaw/config.json` 配置。
