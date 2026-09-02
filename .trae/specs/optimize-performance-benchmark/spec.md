# 性能与加载速度全面优化 Spec

## Why
仪表盘及全站页面存在明确的性能浪费：首屏 bundle 含重依赖（framer-motion 编排面板全局静态引入）、服务端查询有反模式（拉 10000 行任务只为计数）、islands 重复请求同一数据、两个 Google 字体全站加载但 CSS 中零引用。用户要求"全面大幅度优化 + benchmark"。

## What Changes
- **Benchmark 基线先行**：用 `next build` 的路由级 First Load JS 表 + Lighthouse（FCP/LCP/TBT/TTI）对 4 个关键页面建立优化前基线，优化后复测对比，产出报告。
- **首屏 bundle 瘦身**：
  - OrchestratorPanel / FloatingAIButton 改 `next/dynamic`（ssr:false）懒加载，framer-motion 移出首屏 bundle（[app-shell.tsx](file:///x:/xrak/yuz/cross-dashboard/components/layout/app-shell.tsx) 目前静态 import）。
  - 移除零引用依赖 `recharts`（全库 grep 无 import）。
  - 移除零引用 Google 字体 Sora、Geist Mono（globals.css 无 `--font-sora`/`--font-geist-mono` 引用）。
- **服务端数据层优化**：
  - `DashboardService.getStats()`：`getTasks({ pageSize: 10000 })` 拉全表改为 Supabase `count: "exact", head: true` 计数查询（[dashboard.service.ts#L18-L36](file:///x:/xrak/yuz/cross-dashboard/lib/services/dashboard.service.ts#L18-L36)）。
  - `StatsIsland`：`getDashboardData()` 内部已含 `getWorkflowStatuses()`，删除外部重复调用并 Promise.all 并行。
  - `getDbAsync()` 用 React `cache()` 做每请求去重（各 island 每次渲染都调一次）。
- **明确不做**（权衡说明）：不给仪表盘数据加 `"use cache"` 持久缓存 —— 会与已上线的 data-changed 实时联动（router.refresh）冲突，违背"环环相扣"需求。

## Impact
- Affected specs: run-e2e-integration-tests（e2e 全量回归须保持通过）
- Affected code:
  - `components/layout/app-shell.tsx`（懒加载编排组件）
  - `lib/services/dashboard.service.ts`（计数查询）
  - `app/dashboard/islands/stats-island.tsx`（去重 + 并行）
  - `lib/db/index.ts`（cache() 去重）
  - `app/layout.tsx`、`app/globals.css`（字体）
  - `package.json`（移除 recharts）
  - 新增 `scripts/benchmark.mjs`（Lighthouse 采集）与 `scripts/README-baseline.md`？不新增 README —— 基线数据直接写入 benchmark 报告文件

## ADDED Requirements

### Requirement: 性能基准测量
系统 SHALL 提供可重复的性能基准采集手段，覆盖构建产物体积与运行时页面指标，并在优化前后各采集一次。

#### Scenario: 建立基线
- **WHEN** 执行 `bun run build` 并记录各路由 First Load JS，再执行 benchmark 脚本对 /dashboard、/tasks、/content-studio、/workflows/ai-advertising 采集 Lighthouse 指标
- **THEN** 优化前基线与优化后结果均被记录为可对比的报告（含日期、commit、指标值）

#### Scenario: 优化效果可量化
- **WHEN** 优化完成后复测
- **THEN** dashboard 首屏 First Load JS 相比基线下降（≥10%），且 Lighthouse FCP/LCP 不劣化

### Requirement: 首屏 bundle 瘦身
系统 SHALL 将非首屏必需的重依赖组件懒加载，并移除零引用的依赖与字体。

#### Scenario: 编排面板懒加载
- **WHEN** 访问任意页面未打开编排面板
- **THEN** framer-motion 相关 chunk 不出现在首屏加载列表中；点击「发起编排」时按需加载，面板功能不变（Ctrl+Shift+A、会话切换等）

#### Scenario: 零引用依赖清除
- **WHEN** 全库检索 recharts / --font-sora / --font-geist-mono
- **THEN** 无任何 import/引用残留，`bunx tsc --noEmit` 与 build 通过

### Requirement: 服务端数据查询优化
系统 SHALL 消除服务端统计查询的全表拉取与重复请求。

#### Scenario: 任务计数不再拉全表
- **WHEN** DashboardService.getStats() 执行
- **THEN** 仅使用 head count 查询获取各状态任务数，不下载任务明细行

#### Scenario: 仪表盘 islands 无重复请求
- **WHEN** dashboard 页 SSR 渲染
- **THEN** getWorkflowStatuses 在一次渲染中至多执行一次，getDbAsync 每请求至多执行一次真实连接初始化

## MODIFIED Requirements
（无既有 spec 需求修改）

## REMOVED Requirements
（无）
