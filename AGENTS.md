# AGENTS.md — cross-dashboard 开发指南

> FlowMind 跨境电商智能编排系统 — 开发者须知

## 这是什么

cross-dashboard 是 **FlowMind** 的前端与后端一体化项目，基于 Next.js 16 App Router 构建。系统通过 RAK 协议引擎协调多个自主智能体（Agent），实现跨境电商核心业务流程的自动化编排。

## 关键规则

### ⚠️ 集群零配置纪律（2026-09-03 起，架构真源 `docs/architecture/2026-09-03-cluster-native-service-architecture.md`）

FlowMind 已切换为「集群原生化服务架构」（三次拍板：权威设计 `docs/architecture/2026-09-03-nextjs-fullstack-architecture.md`）：系统 = **前端全栈**（本仓 Next.js 16，**UI 角色/core-ui**，= **BFF × 前端 Agent 内核 × MCP 客户端** 三支柱融合，一镜像三角色 web/worker/cron）＋ **后端 flowmind**（父目录 `rak-flowmind` Python 技能后端 → 集群 `flowmind-mcp`，core-api/仅内网，云密钥唯一持有者）。全自托管于 XRAK 集群。

1. **端点解析唯一入口 = `lib/cluster`**（服务目录）。业务代码禁止再写 `process.env.X ?? "http://…"` 的散装默认值；新增外部依赖 = 目录加一行（cluster svc DNS / dev mesh / env 逃生门三级解析）。
2. **UI 不允许出现基础设施配置输入框**（MCP 地址、模型/生图 key、DB 连接串等一律零填写，状态只读展示走 `/api/cluster/services`）。设置页只放「业务凭证/登录态」。
3. **凭据不落库**：api_key/base_url 等属集群 Secret → env 链路，禁止写入 `ai_config`；前端包内禁止出现任何密钥（`NEXT_PUBLIC_*` 白名单只剩端点提示）。
4. **浏览器只访问同源 `flowmind.xrak.top`**（边缘同源反代；`/api/*` 由本 Next.js 全栈服务自己承载，**没有也不许引入独立后端服务**；`flowmind.api.xrak.top` 只是同一服务的机器流量域；`/backend-mcp` → 内网 flowmind-mcp）；跨域方案被否，勿引入 CORS 配置。
5. **全栈分层方向（F1 已落地）**：UI 层（components/hooks/stores/lib/kernel/lib/ui）**禁止 import** `lib/server/**`（eslint `no-restricted-imports` 强制）；服务端能力（lib/server：services/db/ai/kernel 编排等）只经 RSC props、`/api/*`、Server Actions 到达 UI；跨边界类型放 `lib/shared`；MCP 协议层在 `lib/mcp`（支柱三）。
6. 部署/接入/GitOps 操作按 `deploy/README.md` + rak-infra skill 执行，**一切 manifest 走 git（argocd-apps），手改集群会被 selfHeal 反杀**。

### ⚠️ 这不是你熟悉的 Next.js

本项目使用 Next.js 16.2.6，有破坏性变更。编写代码前**必须**阅读 `node_modules/next/dist/docs/` 中的指南。注意弃用通知。

### 包管理器

**必须使用 Bun**（不是 npm/pnpm/yarn）。

```bash
bun install          # 安装依赖
bun run dev          # 开发服务器
bun run build        # 生产构建
bun run test:e2e     # E2E 测试
```

### 无单元测试

本项目**没有单元测试**，只有 Playwright E2E 测试（`e2e/` 目录）。测试配置在 `playwright.config.ts` 中，仅使用 Chromium 浏览器。

### Tailwind CSS v4

**没有 `tailwind.config.*` 文件**。主题在 `globals.css` 中通过 `@theme inline` 块配置，使用 CSS 变量映射。

自定义工作流颜色：`text-wf-product`、`bg-wf-imaging` 等（`--wf-product`、`--wf-imaging`、`--wf-ad`、`--wf-listing`、`--wf-inventory`、`--wf-competitor`）。

## 架构概览

```
API Routes (app/api/)  ←→  Services (lib/services/)  ←→  Repositories (lib/repositories/)  ←→  SQLite (lib/db/)
                                                       ↕
                                                  RAK Engine (lib/rak/)
                                                       ↕
                                                  AI Providers (lib/ai/)
```

### 数据流（双路径）

1. **客户端**：React 组件 → hooks (`hooks/use-*.ts`) → `fetch('/api/...')` → API Route → Service → Repository → SQLite
2. **服务端 (SSR)**：Island 组件 (`islands/*-island.tsx`) → Service → Repository → SQLite → props → Client 组件

两条路径共享同一个 SQLite 数据库（sql.js，存储在 `./data/flowmind.db`）。

### 页面结构模式

每个页面遵循以下布局：

```
app/<section>/
  page.tsx              ← Server Component，导入 island
  <section>-client.tsx  ← "use client" 组件，包含所有 UI 逻辑
  islands/
    <section>-island.tsx ← Server Component，通过 service 获取数据，传递 props
  loading.tsx           ← Suspense 骨架屏
  error.tsx             ← 错误边界
```

### API 路由模式

所有 API 路由使用 `withDb()` 包装器确保数据库初始化：

```typescript
import { withDb } from "@/lib/api-helpers";
export const GET = withDb(async (request: NextRequest) => {
  // ... 业务逻辑
  return success(data);
});
```

请求体验证使用 `parseBody()`（Zod schema），响应使用 `success()` / `error()` / `notFound()` 等标准格式。

## 关键目录

| 目录 | 说明 |
|------|------|
| `lib/db/` | 数据库层（sql.js WASM + CompatDatabase 封装） |
| `lib/repositories/` | 数据访问层，每个实体一个 Repository |
| `lib/services/` | 业务逻辑层，纯类，按需实例化 |
| `lib/rak/` | RAK 协议引擎（Coordinator / Mesh / Conflict / Consensus） |
| `lib/ai/` | AI Provider 适配器（mock / Claude / OpenAI） |
| `lib/agent-runtime/` | Agent 自主运行时（生命周期、情绪状态机、决策、日志） |
| `lib/ziniao/` | 紫鸟浏览器桥接客户端 |
| `lib/crawlers/` | 爬虫实现 |
| `lib/types.ts` | 所有共享 TypeScript 接口 |
| `lib/api-response.ts` | 标准化 API 响应辅助函数 |
| `lib/api-validation.ts` | Zod 验证 schema |
| `lib/api-helpers.ts` | `withDb()` 包装器 |
| `hooks/` | 客户端 hooks，基于 `useFetch<T>` |
| `components/ui/` | 24 个 Radix UI 基础组件 |
| `components/agents/` | Agent 专用组件（人格卡、日志时间线、情绪、心跳、记忆、目标、活动流） |
| `e2e/` | Playwright E2E 测试 |

## 六大工作流子系统

| 工作流 | 路由前缀 | API 子路由 |
|--------|----------|-----------|
| 选品工作流 | `/workflows/product-research` | execute, keywords, data-sources, pain-points |
| AI 作图 | `/workflows/ai-imaging` | images, generate, storyboard |
| AI 广告 | `/workflows/ai-advertising` | keywords, analyze, optimize, export |
| AI 上架 | `/workflows/ai-listing` | generate, bullets, categories, infringement, publish |
| 库销比 | `/workflows/inventory` | restock-suggestions, restock-order, generate-suggestions |
| 竞品广告分析 | `/workflows/competitor-ads` | competitors, keywords, positions, analyze |

## Agent 生命系统

Agent 具有自主运行时（`lib/agent-runtime/`），包含：

- **情绪状态机**：6 种情绪（focused / alert / tired / stressed / curious / satisfied），基于能量值和活动自动转换
- **决策循环**：wake → context → think → journal → decide → mood → emit
- **日志系统**：4 种日志类型（thought / decision / observation / reflection）
- **人格配置**：系统提示词、沟通风格、专业领域
- **目标管理**：带优先级和进度的多目标追踪

## 数据库

- **引擎**：sql.js（纯 JS SQLite WASM），兼容 Bun 和 Node.js
- **文件**：`./data/flowmind.db`（通过 `RAK_DB_PATH` 环境变量配置）
- **初始化**：首次运行自动建表并填充种子数据
- **封装**：`CompatDatabase` 提供 bun:sqlite 兼容 API
- **迁移**：轻量级迁移在 `lib/db/index.ts` 中（ALTER TABLE + CREATE TABLE IF NOT EXISTS）

## AI 配置

AI Provider 通过适配器模式接入，支持三种模式：

| Provider | 说明 |
|----------|------|
| `mock` | 模拟数据，不调用真实 API（默认，开发/演示用） |
| `claude` | Claude API |
| `openai` | OpenAI 兼容 API |

配置存储在 `ai_config` 表中，启动时从环境变量同步。设置页面（`/settings`）提供可视化配置界面。

## 紫鸟浏览器桥接

爬虫中心通过 `lib/ziniao/client.ts` 连接本地紫鸟防关联浏览器，支持：

- 店铺列表 / 打开 / 关闭
- 页面访问 / 内容提取 / 元素操作
- 截图 / 脚本执行 / 自动化流程

桥接默认地址：`http://127.0.0.1:9481`，API Key 通过 `ZCLAW_API_KEY` 环境变量或 `~/.zclaw/config.json` 配置。

## Git 约定

- 提交信息格式：`<type>: <描述>`（feat/fix/docs/refactor）
- 按逻辑单元频繁提交，不要积累大量变更
- 分支命名：`feat/<描述>`

## E2E 测试

Playwright 测试在 `e2e/` 目录下，每个页面一个 spec 文件：

- `agents.spec.ts` — Agent 页面
- `dashboard.spec.ts` — 仪表盘
- `evolution.spec.ts` — 自进化
- `memory.spec.ts` — 记忆系统
- `navigation.spec.ts` — 导航（侧边栏跳转）
- `risk.spec.ts` — 风控中心
- `rsc-features.spec.ts` — RSC/Suspense 行为
- `tasks.spec.ts` — 任务中心
- `workflows.spec.ts` — 工作流页面

运行方式：`bun run test:e2e`（全部）或 `bun run test:e2e -- e2e/agents.spec.ts`（单个文件）。
