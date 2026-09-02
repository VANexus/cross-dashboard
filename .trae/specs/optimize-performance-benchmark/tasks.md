# Tasks

- [x] Task 1: 建立 Benchmark 基线（优化前）
  - [x] 1.1 执行 `bun run build`，记录各路由 First Load JS 体积表（dashboard / tasks / content-studio / workflows/*）※ Next 16 Turbopack 不输出该表，改为 chunk 体积统计
  - [x] 1.2 新增 `scripts/benchmark.mjs`：调用 `bunx lighthouse` 对 /dashboard、/tasks、/content-studio、/workflows/ai-advertising 采集 FCP/LCP/TBT/Performance 分数，输出 JSON+摘要
  - [x] 1.3 将优化前基线数据（含日期）写入 `.trae/specs/optimize-performance-benchmark/benchmark-report.md` 的"基线"章节
- [x] Task 2: 首屏 bundle 瘦身
  - [x] 2.1 app-shell.tsx 中 OrchestratorPanel、FloatingAIButton 改 next/dynamic（ssr:false，loading null），确认懒加载后快捷键/按钮功能不变
  - [x] 2.2 从 package.json 移除零引用依赖 recharts，`bun install` 后 tsc + build 通过
  - [x] 2.3 移除 app/layout.tsx 中 Sora、Geist Mono 字体加载（※ globals.css 存在 5 处实际引用，已一并清理：4 处 font-family 与 --font-mono 映射），build 通过且页面字体渲染无回归
- [x] Task 3: 服务端数据层优化
  - [x] 3.1 DashboardService.getStats() 改为 head count 查询（total/running/completed/failed），删除 getTasks({pageSize:10000}) 全表拉取
  - [x] 3.2 StatsIsland 去掉重复的 getWorkflowStatuses() 调用（改用 dashboard.workflows）※ 未并行 getDbAsync 与 getDashboardData：空库首次渲染存在 seed upsert 竞态，保持串行
  - [x] 3.3 getDbAsync 用 React cache() 包装做每请求去重（原已有模块级单例，叠加 cache() 兼容）
- [x] Task 4: 优化后复测与回归
  - [x] 4.1 `bunx tsc --noEmit` + `bun run build` 通过
  - [x] 4.2 全量 e2e（90 用例）通过（88 passed + 2 flaky retry 通过，flaky 为既有双 h1 问题），dashboard.spec.ts 全过
  - [x] 4.3 复跑 chunk 体积统计 + benchmark.mjs，优化后数据已写入 benchmark-report.md"优化后"章节（首屏 JS -118KB/-8.9%，Lighthouse 4 页 perf 提升或持平，LCP/TBT 改善）

# Task Dependencies
- Task 2、Task 3 相互独立，可并行
- Task 4 依赖 Task 1（基线）、Task 2、Task 3 全部完成
- Task 1.2 的 benchmark.mjs 被 Task 4.3 复用
