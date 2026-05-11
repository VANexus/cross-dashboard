# FlowMind 前端现代化改造计划

## 目标

将 FlowMind 从 **纯 CSR（15个"use client"页面 + 内联 mock 数据）** 改造为 **RSC + CSR 混合架构**，运用流式渲染、Suspense、动态导入、Proxy 中间件、`use cache` 缓存等 Next.js 16 新特性。

---

## 当前状态

| 维度 | 现状 |
|------|------|
| 服务端组件 | 仅根 `page.tsx`（redirect） |
| 客户端组件 | **15/15** 页面全部 `"use client"` |
| 数据获取 | 全部内联 mock 或从 `@/lib/mock-data` 导入 |
| loading.tsx | **0 个** |
| error.tsx | **0 个** |
| not-found.tsx | **0 个** |
| global-error.tsx | **0 个** |
| proxy.ts | **不存在** |
| next.config.ts | 空配置 |
| 动态导入 | **0 处** |
| Suspense 边界 | **0 处** |

---

## Phase 1: 基础设施配置（1 个文件）

### 1.1 更新 `next.config.ts`

- 启用 `cacheComponents: true`（支持 `use cache` 指令）
- 启用 `reactCompiler: true`（React 编译器稳定版）
- 配置图片优化

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactCompiler: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
```

### 1.2 创建 `proxy.ts`（取代已废弃的 middleware.ts）

Next.js 16 将 `middleware` 重命名为 `proxy`，文件名和导出名都变了。

- 文件位置：`d:\dev\app\proxy.ts`（必须在 app/ 目录下）
- 功能：
  - API 路由日志记录
  - 请求头注入（X-Request-Id）
  - 安全头设置
  - 未来可扩展认证/鉴权

```ts
import { type NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

---

## Phase 2: 根 Layout 拆分（RSC 边界）（3 个文件）

### 2.1 重构 `app/layout.tsx` → 纯 RSC

**现状**：layout.tsx 直接导入并渲染 Client Components（Sidebar、TopBar、ThemeProvider、TooltipProvider），虽然 layout 本身没有 `"use client"`，但所有子组件都是客户端组件。

**改造**：
- layout.tsx 保持为 RSC（导出 metadata、font 配置等）
- 提取 `AppShell` Client Component 包裹所有交互逻辑
- Sidebar、TopBar 改为动态导入（`next/dynamic`，ssr: false）

**修改文件**：`app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FlowMind | 跨境电商智能编排系统",
  description: "多模态工作流智能编排与自进化决策系统",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

### 2.2 新建 `components/layout/app-shell.tsx`（Client Component）

封装 ThemeProvider、TooltipProvider、动态导入的 Sidebar 和 TopBar。

```tsx
"use client";

import dynamic from "next/dynamic";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/providers/theme-provider";

const Sidebar = dynamic(() => import("@/components/layout/sidebar").then(m => ({ default: m.Sidebar })), { ssr: false });
const TopBar = dynamic(() => import("@/components/layout/topbar").then(m => ({ default: m.TopBar })), { ssr: false });

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex flex-1 flex-col ml-[260px] transition-all duration-300">
            <TopBar />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </TooltipProvider>
    </ThemeProvider>
  );
}
```

### 2.3 动态导入 TopBar 中的重型组件

**修改文件**：`components/layout/topbar.tsx`

- `CommandPalette` → `dynamic(() => import(...), { ssr: false })`
- `NotificationPanel` → `dynamic(() => import(...), { ssr: false })`

---

## Phase 3: 全局错误与 404（2 个新文件）

### 3.1 `app/global-error.tsx`

处理根布局中的未捕获错误，必须包含 `<html>` 和 `<body>`，必须是 Client Component。

### 3.2 `app/not-found.tsx`

全局 404 页面，带有返回首页链接。

---

## Phase 4: 逐页 RSC 改造（15 个页面 + 对应 loading/error）

### 改造模式（统一应用于所有页面）

每个页面改造遵循同一模式：

```
app/<route>/
├── page.tsx          ← RSC（async，从 BFF fetch 数据，用 Suspense 包裹子组件）
├── loading.tsx       ← 骨架屏（流式渲染 fallback）
├── error.tsx         ← 错误边界（Client Component，reset 重试）
└── <module>-client.tsx  ← 交互式 Client Component（原页面的交互逻辑）
```

**关键原则**：
1. `page.tsx` 移除 `"use client"`，改为 `async` RSC
2. RSC 中用 `fetch()` 调用本地 BFF API 路由获取数据（走 server-side fetch，无需网络开销）
3. 交互逻辑拆到 `*-client.tsx`，通过 props 传入数据
4. 大型 Client Component 用 `next/dynamic` 懒加载
5. 多个数据源用并行 `Promise.all` + `<Suspense>` 实现流式渲染

### 4.1 Dashboard 页面

**文件**：`app/dashboard/page.tsx` → RSC + `app/dashboard/dashboard-client.tsx`

- `page.tsx`：async RSC，`fetch("http://localhost/api/dashboard")` 获取数据
- `dashboard-client.tsx`：原 240 行的交互式 Dashboard UI
- `loading.tsx`：4 个 data-grid skeleton + workflow list skeleton + trend cards skeleton
- `error.tsx`：错误卡片 + 重试按钮

**数据获取策略**：
```tsx
// page.tsx (RSC)
export default async function DashboardPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const data = await fetch(`${baseUrl}/api/dashboard`, { cache: "no-store" }).then(r => r.json());
  return <DashboardClient initialData={data.data} />;
}
```

### 4.2 Agents 列表页面

**文件**：`app/agents/page.tsx` → RSC + `app/agents/agents-client.tsx`

- `page.tsx`：fetch `/api/agents`
- `agents-client.tsx`：Agent 卡片网格、状态筛选
- `loading.tsx`：6 个 agent 卡片 skeleton
- `error.tsx`

### 4.3 Agent 详情页面（动态路由）

**文件**：`app/agents/[id]/page.tsx` → RSC + `app/agents/[id]/agent-detail-client.tsx`

- `page.tsx`：async，`params` 必须 `await`（Next.js 16 breaking change）
- `loading.tsx`：详情页 skeleton
- `error.tsx`

```tsx
export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const [agent, tasks] = await Promise.all([
    fetch(`${baseUrl}/api/agents/${id}`).then(r => r.json()),
    fetch(`${baseUrl}/api/tasks?agentId=${id}`).then(r => r.json()),
  ]);
  if (!agent.data) notFound();
  return <AgentDetailClient agent={agent.data} tasks={tasks.data} />;
}
```

### 4.4 Tasks 列表页面

**文件**：`app/tasks/page.tsx` → RSC + `app/tasks/tasks-client.tsx`

- `page.tsx`：fetch `/api/tasks`
- `tasks-client.tsx`：任务列表、搜索过滤、视图切换
- `loading.tsx`：任务列表 skeleton
- `error.tsx`

### 4.5 Task 详情页面（动态路由）

**文件**：`app/tasks/[id]/page.tsx` → RSC + `app/tasks/[id]/task-detail-client.tsx`

- `page.tsx`：await params，fetch `/api/tasks/:id`
- `loading.tsx`、`error.tsx`

### 4.6 Risk（风控）页面

**文件**：`app/risk/page.tsx` → RSC + `app/risk/risk-client.tsx`

- `page.tsx`：并行 fetch `/api/risk/health` + `/api/risk/events` + `/api/risk/isolation`
- 用 `<Suspense>` 包裹三个独立区块实现流式渲染：
  ```tsx
  <Suspense fallback={<HealthSkeleton />}><HealthSection /></Suspense>
  <Suspense fallback={<EventsSkeleton />}><EventsSection /></Suspense>
  <Suspense fallback={<IsolationSkeleton />}><IsolationSection /></Suspense>
  ```
- `loading.tsx`、`error.tsx`

### 4.7 Memory（记忆系统）页面

**文件**：`app/memory/page.tsx` → RSC + `app/memory/memory-client.tsx`

- `page.tsx`：fetch `/api/memory`
- `memory-client.tsx`：Tab 切换、搜索过滤
- `loading.tsx`、`error.tsx`

### 4.8 Evolution（自进化）页面

**文件**：`app/evolution/page.tsx` → RSC + `app/evolution/evolution-client.tsx`

- `page.tsx`：并行 fetch `/api/evolution` + `/api/evolution/trend`
- `evolution-client.tsx`：进化记录列表、趋势图
- `loading.tsx`、`error.tsx`

### 4.9 Settings 页面

**文件**：`app/settings/page.tsx`

- Settings 是纯展示+表单，可以保持 `"use client"` 但添加 `loading.tsx` 和 `error.tsx`
- 或者：RSC page + Client form component

### 4.10 Workflow: Product Research（选品）

**文件**：`app/workflows/product-research/page.tsx` → RSC + `.../product-research-client.tsx`

- `page.tsx`：并行 fetch data-sources + keywords + pain-points
- 用 `<Suspense>` 分步流式渲染各区块
- `loading.tsx`：步骤指示器 + 各区块 skeleton
- `error.tsx`

### 4.11 Workflow: AI Imaging（AI 作图）

**文件**：`app/workflows/ai-imaging/page.tsx` → RSC + `.../ai-imaging-client.tsx`

- `page.tsx`：并行 fetch images + storyboard
- `loading.tsx`：图片 grid skeleton + 分镜 skeleton
- `error.tsx`

### 4.12 Workflow: AI Advertising（AI 广告）

**文件**：`app/workflows/ai-advertising/page.tsx` → RSC + `.../ai-advertising-client.tsx`

- `page.tsx`：fetch ad-keywords
- `loading.tsx`：关键词表格 skeleton
- `error.tsx`

### 4.13 Workflow: AI Listing（AI 上架）

**文件**：`app/workflows/ai-listing/page.tsx` → RSC + `.../ai-listing-client.tsx`

- `page.tsx`：并行 fetch infringement + categories + bullets
- `loading.tsx`：向导步骤 skeleton
- `error.tsx`

### 4.14 Workflow: Inventory（库销比）

**文件**：`app/workflows/inventory/page.tsx` → RSC + `.../inventory-client.tsx`

- `page.tsx`：并行 fetch inventory + restock-suggestions
- `loading.tsx`：SKU 表格 skeleton
- `error.tsx`

### 4.15 Workflow: Competitor Ads（竞品广告）

**文件**：`app/workflows/competitor-ads/page.tsx` → RSC + `.../competitor-ads-client.tsx`

- `page.tsx`：并行 fetch keywords + competitors + positions
- `loading.tsx`：竞品卡片 skeleton
- `error.tsx`

---

## Phase 5: 动态导入重型组件

对以下组件使用 `next/dynamic` 懒加载（ssr: false）：

| 组件 | 文件 | 原因 |
|------|------|------|
| `CommandPalette` | `components/ui/command-palette.tsx` | Dialog + 搜索 + 键盘导航，首次不渲染 |
| `NotificationPanel` | `components/ui/notification-panel.tsx` | 面板 + 内联 mock 数据，首次不渲染 |
| `Sparkline` | `components/ui/sparkline.tsx` | Canvas/SVG 图表，RSC 不兼容 |
| `AnimatedNumber` | `components/ui/animated-number.tsx` | 动画数字，需要 useEffect |

在各 Client Component 内部使用：
```tsx
const Sparkline = dynamic(() => import("@/components/ui/sparkline").then(m => ({ default: m.Sparkline })), {
  loading: () => <div className="h-8 w-24 skeleton rounded" />,
  ssr: false,
});
```

---

## Phase 6: 缓存策略

### 6.1 `use cache` 用于半静态数据

对不频繁变化的数据使用组件级 `use cache`：

```tsx
// 适用于：Agent 列表、Workflow Status、Memory Zones 等
async function CachedAgentList() {
  "use cache";
  cacheTag("agents");
  cacheLife("minutes");
  const data = await fetch(`${baseUrl}/api/agents`);
  return <AgentGrid agents={data} />;
}
```

### 6.2 Route Segment 配置

| 页面 | `dynamic` | `revalidate` | 说明 |
|------|-----------|-------------|------|
| dashboard | `'force-dynamic'` | `false` | 实时数据，不缓存 |
| agents | - | `60` | Agent 列表相对稳定 |
| tasks | `'force-dynamic'` | `false` | 任务状态实时变化 |
| risk | `'force-dynamic'` | `false` | 风控数据需要实时 |
| memory | - | `30` | 记忆条目变化不频繁 |
| evolution | - | `60` | 进化记录低频更新 |
| settings | `'force-static'` | `false` | 纯静态配置页 |
| workflows/* | `'force-dynamic'` | `false` | 工作流数据实时 |

### 6.3 Cache Invalidation

通过 Server Actions 在数据变更后调用：
```tsx
import { revalidateTag } from "next/cache";
revalidateTag("agents", "max");
```

---

## Phase 7: 文件变更清单

### 新建文件（约 35 个）

| 文件路径 | 类型 |
|---------|------|
| `app/proxy.ts` | Proxy 中间件 |
| `app/global-error.tsx` | 全局错误边界 |
| `app/not-found.tsx` | 全局 404 |
| `components/layout/app-shell.tsx` | 根布局 Client Shell |
| `app/dashboard/loading.tsx` | Dashboard 骨架屏 |
| `app/dashboard/error.tsx` | Dashboard 错误边界 |
| `app/dashboard/dashboard-client.tsx` | Dashboard Client Component |
| `app/agents/loading.tsx` | Agent 列表骨架屏 |
| `app/agents/error.tsx` | Agent 错误边界 |
| `app/agents/agents-client.tsx` | Agent 列表 Client |
| `app/agents/[id]/loading.tsx` | Agent 详情骨架屏 |
| `app/agents/[id]/error.tsx` | Agent 详情错误边界 |
| `app/agents/[id]/agent-detail-client.tsx` | Agent 详情 Client |
| `app/tasks/loading.tsx` | Tasks 骨架屏 |
| `app/tasks/error.tsx` | Tasks 错误边界 |
| `app/tasks/tasks-client.tsx` | Tasks Client |
| `app/tasks/[id]/loading.tsx` | Task 详情骨架屏 |
| `app/tasks/[id]/error.tsx` | Task 详情错误边界 |
| `app/tasks/[id]/task-detail-client.tsx` | Task 详情 Client |
| `app/risk/loading.tsx` | Risk 骨架屏 |
| `app/risk/error.tsx` | Risk 错误边界 |
| `app/risk/risk-client.tsx` | Risk Client |
| `app/memory/loading.tsx` | Memory 骨架屏 |
| `app/memory/error.tsx` | Memory 错误边界 |
| `app/memory/memory-client.tsx` | Memory Client |
| `app/evolution/loading.tsx` | Evolution 骨架屏 |
| `app/evolution/error.tsx` | Evolution 错误边界 |
| `app/evolution/evolution-client.tsx` | Evolution Client |
| `app/settings/loading.tsx` | Settings 骨架屏 |
| `app/settings/error.tsx` | Settings 错误边界 |
| `app/workflows/product-research/loading.tsx` | 选品骨架屏 |
| `app/workflows/product-research/error.tsx` | 选品错误边界 |
| `app/workflows/product-research/product-research-client.tsx` | 选品 Client |
| `app/workflows/ai-imaging/loading.tsx` | AI 作图骨架屏 |
| `app/workflows/ai-imaging/error.tsx` | AI 作图错误边界 |
| `app/workflows/ai-imaging/ai-imaging-client.tsx` | AI 作图 Client |
| `app/workflows/ai-advertising/loading.tsx` | AI 广告骨架屏 |
| `app/workflows/ai-advertising/error.tsx` | AI 广告错误边界 |
| `app/workflows/ai-advertising/ai-advertising-client.tsx` | AI 广告 Client |
| `app/workflows/ai-listing/loading.tsx` | AI 上架骨架屏 |
| `app/workflows/ai-listing/error.tsx` | AI 上架错误边界 |
| `app/workflows/ai-listing/ai-listing-client.tsx` | AI 上架 Client |
| `app/workflows/inventory/loading.tsx` | 库销比骨架屏 |
| `app/workflows/inventory/error.tsx` | 库销比错误边界 |
| `app/workflows/inventory/inventory-client.tsx` | 库销比 Client |
| `app/workflows/competitor-ads/loading.tsx` | 竞品广告骨架屏 |
| `app/workflows/competitor-ads/error.tsx` | 竞品广告错误边界 |
| `app/workflows/competitor-ads/competitor-ads-client.tsx` | 竞品广告 Client |

### 修改文件（约 19 个）

| 文件路径 | 改动说明 |
|---------|---------|
| `next.config.ts` | 启用 cacheComponents、reactCompiler |
| `app/layout.tsx` | 改为纯 RSC，用 AppShell 包裹 |
| `components/layout/topbar.tsx` | 动态导入 CommandPalette、NotificationPanel |
| `app/dashboard/page.tsx` | 移除 "use client"，改为 async RSC |
| `app/agents/page.tsx` | 同上 |
| `app/agents/[id]/page.tsx` | 同上，await params |
| `app/tasks/page.tsx` | 同上 |
| `app/tasks/[id]/page.tsx` | 同上，await params |
| `app/risk/page.tsx` | 同上 |
| `app/memory/page.tsx` | 同上 |
| `app/evolution/page.tsx` | 同上 |
| `app/settings/page.tsx` | 保持 client 但添加 loading/error |
| `app/workflows/product-research/page.tsx` | 移除 "use client"，改为 async RSC |
| `app/workflows/ai-imaging/page.tsx` | 同上 |
| `app/workflows/ai-advertising/page.tsx` | 同上 |
| `app/workflows/ai-listing/page.tsx` | 同上 |
| `app/workflows/inventory/page.tsx` | 同上 |
| `app/workflows/competitor-ads/page.tsx` | 同上 |

---

## Phase 8: 验证

1. `pnpm build` — 确保 0 错误
2. `pnpm dev` — 逐页面验证：
   - loading 骨架屏正确展示
   - 数据从 BFF API 正确加载
   - 错误状态正确展示和重试
   - Suspense 流式渲染生效
   - 动态导入组件按需加载
3. 检查 Network tab：RSC payload 正确传输
4. 检查 React DevTools：Server/Client Component 边界正确

---

## 实施顺序

```
Phase 1 (基础设施)          → 2 个文件
Phase 2 (Layout 拆分)       → 3 个文件（含修改）
Phase 3 (全局错误/404)      → 2 个新文件
Phase 4 (逐页改造)          → 核心工作，按模块分批
  4.1  Dashboard（示例页面，确立模式）
  4.2  Agents（列表 + 详情）
  4.3  Tasks（列表 + 详情）
  4.4  Risk
  4.5  Memory
  4.6  Evolution
  4.7  Settings
  4.8-4.15  6 个 Workflow 页面
Phase 5 (动态导入)          → 在 Phase 2/4 中一并完成
Phase 6 (缓存策略)          → 在 Phase 4 中一并设置
Phase 7 (验证)              → pnpm build + pnpm dev
```

**总计**：约 50 个文件变更（约 35 个新建 + 约 15 个修改）
