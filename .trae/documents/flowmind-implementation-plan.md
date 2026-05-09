# FlowMind 跨境电商多模态工作流智能编排系统 — 实施计划

## 一、项目概述

基于设计文档构建 **FlowMind** 前端Web应用系统，采用 Next.js 16.2.6 + React 19 + Tailwind CSS v4 技术栈，实现跨境电商AI智能体编排平台的完整UI。

## 二、技术栈

| 层面 | 选型 |
|------|------|
| 框架 | Next.js 16.2.6 (App Router, Turbopack) |
| UI库 | Radix UI + Tailwind CSS v4 + class-variance-authority |
| 图标 | lucide-react |
| 图表 | recharts |
| 状态管理 | zustand |
| 工具 | clsx + tailwind-merge + date-fns |

## 三、Next.js 16 关键约束

1. **异步请求API** — `params`, `searchParams`, `cookies()`, `headers()` 都是 Promise，必须 await
2. **middleware→proxy** — 已重命名为 `proxy.ts`，export `proxy` 函数
3. **Turbopack 默认** — `next dev/build` 默认 Turbopack
4. **并行路由** — 所有 parallel route slots 需 `default.tsx`
5. **缓存API** — `revalidateTag` 需第二个参数，`cacheLife/cacheTag` 已稳定
6. **类型工具** — 使用 `PageProps<'/path'>` 和 `LayoutProps<'/path'>` 辅助类型

## 四、项目结构

```
app/
├── layout.tsx                    # 根布局 (Sidebar + TopBar)
├── page.tsx                      # → redirect to /dashboard
├── globals.css                   # 全局样式 + 设计系统变量
├── dashboard/
│   └── page.tsx                  # 仪表盘首页
├── agents/
│   ├── page.tsx                  # Agent 管理总览
│   └── [id]/
│       └── page.tsx              # 单个 Agent 详情
├── tasks/
│   ├── page.tsx                  # 任务列表
│   └── [id]/
│       └── page.tsx              # 任务详情
├── business/
│   ├── operations/
│   │   └── page.tsx              # 运营分析
│   ├── marketing/
│   │   └── page.tsx              # 营销中心
│   ├── finance/
│   │   └── page.tsx              # 财务中心
│   └── legal/
│       └── page.tsx              # 法务中心
├── memory/
│   └── page.tsx                  # 三区记忆系统
├── risk/
│   └── page.tsx                  # 风险熔断监控
├── evolution/
│   └── page.tsx                  # 自进化追踪
├── settings/
│   └── page.tsx                  # 系统设置
└── api/                          # API 路由
    ├── agents/route.ts
    ├── tasks/route.ts
    └── dashboard/route.ts

components/
├── layout/
│   ├── sidebar.tsx               # 侧边导航栏
│   └── topbar.tsx                # 顶部状态栏
├── ui/                           # 基础UI组件 (手动实现shadcn风格)
│   ├── button.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── tabs.tsx
│   ├── tooltip.tsx
│   ├── separator.tsx
│   ├── scroll-area.tsx
│   ├── avatar.tsx
│   ├── progress.tsx
│   ├── switch.tsx
│   ├── select.tsx
│   ├── input.tsx
│   └── textarea.tsx
├── dashboard/
│   ├── agent-status-card.tsx     # Agent 状态卡片
│   ├── task-overview-chart.tsx   # 任务概览图表
│   ├── system-metrics.tsx        # 系统指标
│   └── risk-alerts.tsx           # 风险告警
├── agents/
│   ├── agent-card.tsx            # Agent 卡片
│   ├── agent-detail.tsx          # Agent 详情
│   ├── heartbeat-monitor.tsx     # 心跳监控
│   └── agent-flow.tsx            # Agent 关系流
├── tasks/
│   ├── task-list.tsx             # 任务列表
│   ├── task-card.tsx             # 任务卡片
│   └── task-detail.tsx           # 任务详情
├── business/
│   ├── operations/
│   │   ├── product-selector.tsx  # 选品分析
│   │   ├── inventory-chart.tsx   # 库销比
│   │   ├── ai-listing.tsx        # AI上架
│   │   └── account-monitor.tsx   # 账号监控
│   ├── marketing/
│   │   ├── copy-generator.tsx    # 文案生成
│   │   ├── ad-manager.tsx        # 广告管理
│   │   └── cs-panel.tsx          # 客服面板
│   ├── finance/
│   │   ├── revenue-chart.tsx     # 营收图表
│   │   ├── cost-profit.tsx       # 成本利润
│   │   └── cashflow.tsx          # 资金周转
│   └── legal/
│       ├── patent-monitor.tsx    # 专利监控
│       ├── contract-manager.tsx  # 合同管理
│       └── dispute-tracker.tsx   # 纠纷追踪
├── memory/
│   ├── preset-zone.tsx           # 预设区
│   ├── dev-zone.tsx              # 开发区
│   └── prompt-zone.tsx           # Prompt区
├── risk/
│   ├── circuit-breaker.tsx       # 熔断器面板
│   └── risk-timeline.tsx         # 风险时间线
└── evolution/
    ├── evolution-pipeline.tsx    # 自进化流水线
    └── capability-tree.tsx       # 能力树

lib/
├── utils.ts                      # cn() 工具函数
├── mock-data.ts                  # Mock 数据
└── types.ts                      # TypeScript 类型定义

stores/
├── dashboard-store.ts            # 仪表盘状态
├── agent-store.ts                # Agent 状态
└── task-store.ts                 # 任务状态
```

## 五、分阶段实施

### Phase 1: 基础设施 + 布局框架
1. **创建 lib/utils.ts** — cn() 工具函数
2. **创建 lib/types.ts** — 系统类型定义
3. **创建基础UI组件** — Button, Card, Badge, Input, Avatar, Progress, Separator 等
4. **更新 globals.css** — 设计系统变量、暗色模式支持、FlowMind品牌色
5. **创建 layout/sidebar.tsx** — 侧边导航栏（Dashboard/Agents/Tasks/Business/Memory/Risk/Evolution/Settings）
6. **创建 layout/topbar.tsx** — 顶部状态栏（搜索、通知、用户头像、系统状态指示灯）
7. **更新 app/layout.tsx** — 集成 Sidebar + TopBar
8. **更新 app/page.tsx** — 重定向到 /dashboard

### Phase 2: 核心监控页面
1. **Dashboard 仪表盘** — 4个核心区域：
   - Agent 状态总览卡片（在线/忙碌/错误/离线数量）
   - 任务执行图表（recharts折线/柱状图）
   - 系统性能指标（CPU/内存/响应时间/吞吐量）
   - 最近风险告警列表
2. **Agent 管理页面** — 
   - Agent 卡片网格（Sentinel/Dispatch/4个Expert Agent）
   - 心跳监控可视化（双模式：时间驱动+事件驱动）
   - Agent 详情页（能力描述/任务历史/性能指标）
   - Agent 关系流图（SVG/Canvas实现）

### Phase 3: 业务模块
1. **运营分析** — 选品分析表格、库销比图表、AI上架队列、账号监控面板
2. **营销中心** — 文案生成器、广告管理、客服面板
3. **财务中心** — 营收趋势图、成本利润分析、资金周转指标
4. **法务中心** — 专利监控、合同管理、纠纷追踪
5. **任务工作流** — 任务列表（筛选/排序/分页）、任务详情（时间线/Agent分配/输出）

### Phase 4: 高级功能
1. **三区记忆系统** — 预设区（只读脚本列表）、开发区（动态代码沙箱视图）、Prompt区（上下文记忆栈+Skill索引）
2. **风险熔断监控** — 三级熔断面板（Ⅲ级预警/Ⅱ级熔断/Ⅰ级隔离）、风险时间线
3. **自进化追踪** — 进化流水线（需求识别→代码生成→沙箱测试→审查归档→能力复用）、能力树可视化

### Phase 5: API + 数据集成
1. **API路由** — /api/agents, /api/tasks, /api/dashboard
2. **Mock数据层** — 完整的模拟数据，覆盖所有页面
3. **Zustand状态管理** — 全局状态存储
4. **页面间联动** — 从Dashboard跳转到具体Agent/任务

## 六、设计系统

### 品牌色彩
- 主色: `#6366f1` (Indigo-500，代表智能编排)
- 辅助: `#0ea5e9` (Sky-500，代表数据流)
- 成功: `#22c55e` (Green-500，Agent在线)
- 警告: `#f59e0b` (Amber-500，Ⅲ级预警)
- 危险: `#ef4444` (Red-500，Ⅰ级隔离)
- 背景: `#0f172a` (Slate-900，深色主题)

### 布局
- 侧边栏: 固定左侧 260px，可折叠
- 顶部栏: 固定顶部 64px
- 主内容区: 响应式填充

## 七、验证步骤

1. `pnpm build` — 构建无报错
2. `pnpm lint` — ESLint 通过
3. 手动检查所有页面路由可访问
4. 暗色/亮色模式切换正常
