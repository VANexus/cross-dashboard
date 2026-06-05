# FlowMind — 跨境电商智能编排系统

> 多模态工作流智能编排与自进化决策系统，基于 RAK 跨物种智能体协同协议

## 简介

FlowMind 是一个面向跨境电商的智能编排系统，通过多个自主智能体（Agent）协同工作，实现选品分析、AI 制图、广告优化、商品发布、库存管理、竞品分析等核心业务流程的自动化编排与决策。

系统采用 **Next.js 16 App Router** 构建，前端 UI 全部为中文（zh-CN），后端通过 **RAK 协议引擎** 实现智能体间的分布式协调与共识。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16.2.6 (App Router) + React 19 |
| 语言 | TypeScript 5 |
| 包管理 | **Bun**（非 npm/pnpm） |
| 样式 | Tailwind CSS v4（无 `tailwind.config.*`，主题在 `globals.css` 中通过 `@theme inline` 配置） |
| UI 组件 | Radix UI + shadcn/ui 模式（24 个组件） |
| 数据库 | sql.js（纯 JS SQLite WASM），数据文件：`./data/flowmind.db` |
| 图表 | Recharts v3 |
| 动画 | Framer Motion v12 |
| 状态管理 | Zustand v5 + next-themes |
| 表单验证 | Zod v4 |
| 表格 | @tanstack/react-table |
| 图标 | lucide-react |
| 测试 | Playwright E2E（无单元测试） |

## 快速开始

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev

# 生产构建
bun run build
bun run start

# 运行 E2E 测试
bun run test:e2e

# 列出所有测试
bun run test:e2e:list
```

访问 http://localhost:3000 查看系统（自动重定向到 `/dashboard`）。

## 环境变量

在 `.env.local` 中配置：

```bash
# AI 配置
AI_PROVIDER=mock              # mock | claude | openai
AI_MODEL=claude-sonnet-4-20250514
AI_BASE_URL=https://api.openai.com
AI_API_KEY=sk-...
AI_MAX_TOKENS=4096
AI_TEMPERATURE=0.7
AI_DEMO_MODE=true             # true = 使用模拟数据

# 数据库
RAK_DB_PATH=./data/flowmind.db

# 爬虫桥接
ZCLAW_API_KEY=...             # 紫鸟浏览器桥接 API Key
ZCLAW_BASE_URL=http://127.0.0.1:9481
```

## 页面结构

| 路由 | 功能 | 说明 |
|------|------|------|
| `/dashboard` | 仪表盘 | 系统概览：统计卡片、工作流状态、Agent 心跳、告警、趋势 |
| `/workflows/product-research` | 选品工作流 | 数据源管理、关键词分析、痛点识别 |
| `/workflows/ai-imaging` | AI 作图 | 图片生成、评分、分镜脚本 |
| `/workflows/ai-advertising` | AI 广告 | 关键词优化、ACOS 分析、广告位监控 |
| `/workflows/ai-listing` | AI 上架 | Listing 生成、Bullet Points、侵权检测、类目推荐 |
| `/workflows/inventory` | 库销比 | 库存监控、补货建议、缺货预警 |
| `/workflows/competitor-ads` | 竞品广告分析 | 竞品监控、关键词对比、广告位分析 |
| `/risk` | 账号风险 | 健康评分、风险指标、隔离清单、熔断管理 |
| `/agents` | Agent 管理 | 智能体列表、详情（日志/情绪/目标/记忆） |
| `/tasks` | 任务中心 | 任务列表、详情（步骤/进度/输出） |
| `/crawler` | 爬虫中心 | 紫鸟浏览器桥接、店铺管理、数据采集 |
| `/memory` | 记忆系统 | 记忆条目管理（preset/dev/prompt 区） |
| `/evolution` | 自进化 | 进化记录、阶段追踪、指标对比 |
| `/settings` | 系统设置 | AI 配置、服务器配置、通知设置、安全设置 |

## 项目结构

```
cross-dashboard/
├── app/                          # Next.js App Router
│   ├── api/                      # API 路由
│   │   ├── agents/               # Agent CRUD + 流式接口 + 日志
│   │   ├── tasks/                # 任务 CRUD + 步骤管理
│   │   ├── risk/                 # 风险事件 + 隔离 + 健康检查
│   │   ├── memory/               # 记忆 CRUD + 使用统计
│   │   ├── evolution/            # 进化记录 + 趋势
│   │   ├── dashboard/            # 仪表盘聚合数据
│   │   ├── ai/config/            # AI 配置管理
│   │   ├── crawler/              # 爬虫数据 + 店铺 + 截图
│   │   └── workflows/            # 6 个子工作流 API
│   │       ├── ai-advertising/   # keywords, analyze, optimize, export
│   │       ├── ai-imaging/       # images, generate, storyboard
│   │       ├── ai-listing/       # generate, bullets, categories, infringement, publish
│   │       ├── competitor-ads/   # competitors, keywords, positions, analyze
│   │       ├── inventory/        # restock-suggestions, restock-order, generate-suggestions
│   │       └── product-research/ # execute, keywords, data-sources, pain-points
│   ├── dashboard/                # 仪表盘页面（5 个 Island）
│   ├── agents/                   # Agent 管理（含动态路由 [id]）
│   ├── tasks/                    # 任务中心（含动态路由 [id]）
│   ├── risk/                     # 风控中心
│   ├── memory/                   # 记忆系统
│   ├── evolution/                # 自进化
│   ├── crawler/                  # 爬虫中心
│   ├── settings/                 # 系统设置
│   └── workflows/                # 6 个工作流子页面
├── components/
│   ├── layout/                   # AppShell, Sidebar, TopBar
│   ├── providers/                # ThemeProvider
│   ├── agents/                   # Agent 专用组件（人格卡/日志/情绪/心跳/记忆/目标/活动流）
│   └── ui/                       # 24 个 Radix UI 基础组件
├── hooks/                        # 17 个客户端 hooks（useFetch 基础 + 各领域 hook）
├── lib/
│   ├── rak/                      # RAK 协议引擎（Coordinator/Mesh/Conflict/Consensus）
│   ├── db/                       # 数据库层（sql.js WASM + CompatDatabase）
│   ├── repositories/             # 数据访问层（Repository 模式）
│   ├── services/                 # 业务逻辑层
│   ├── ai/                       # AI Provider 适配器（mock/Claude/OpenAI）
│   ├── agent-runtime/            # Agent 自主运行时（生命周期/情绪/决策/日志）
│   ├── crawlers/                 # 爬虫实现
│   ├── image-gen/                # 图片生成
│   ├── ziniao/                   # 紫鸟浏览器桥接客户端
│   ├── types.ts                  # 共享类型定义
│   ├── api-response.ts           # API 响应格式化
│   ├── api-validation.ts         # Zod 验证 schema
│   └── api-helpers.ts            # withDb() 包装器
├── e2e/                          # Playwright E2E 测试（9 个 spec 文件）
├── data/                         # SQLite 数据文件
└── public/                       # 静态资源
```

## 开发规范

- **包管理器**：必须使用 Bun，不要用 npm/pnpm/yarn
- **Tailwind v4**：没有 `tailwind.config.*` 文件，主题配置在 `globals.css` 的 `@theme inline` 块中
- **无单元测试**：只有 Playwright E2E 测试
- **Next.js 16**：有破坏性变更，编写代码前请阅读 `node_modules/next/dist/docs/`
- **数据库初始化**：API 路由必须使用 `withDb()` 包装器确保数据库已初始化
- **API 响应格式**：统一使用 `success()` / `error()` / `notFound()` 等辅助函数

## 许可证

私有项目，仅供内部使用。
