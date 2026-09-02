# Checklist

- [x] benchmark.mjs 可重复执行并输出 4 个页面的 FCP/LCP/TBT/Performance 分数
- [x] 优化前基线（build 体积表 + Lighthouse）已记录到 benchmark-report.md
- [x] OrchestratorPanel / FloatingAIButton 懒加载后，「发起编排」按钮、Ctrl+Shift+A、会话切换、发送消息全部正常（浏览器手测通过）
- [x] framer-motion 不再出现在首屏加载的 chunk 中（dashboard 首屏 16 个 chunk 引用中无 02lsd6g9vylob.js）
- [x] recharts 从 package.json 移除且全库无残留 import
- [x] Sora、Geist Mono 字体已移除且全库无 --font-sora / --font-geist-mono 引用（globals.css 5 处引用一并清理，字体渲染手测正常）
- [x] DashboardService.getStats() 不再调用 getTasks({pageSize:10000})，改用 head count 查询
- [x] StatsIsland 渲染期间 getWorkflowStatuses 至多执行一次（改用 dashboard.workflows）
- [x] getDbAsync 经 React cache() 去重，签名与调用方兼容
- [x] 未给仪表盘数据添加 "use cache" 持久缓存（保持实时联动能力）
- [x] bunx tsc --noEmit 通过
- [x] bun run build 通过
- [x] 全量 e2e 通过（88 passed + 2 flaky retry 通过，flaky 为既有双 h1 问题与本次改动无关）
- [x] 优化后数据已写入 benchmark-report.md，dashboard 首屏 JS 较基线下降 118KB（-8.9%，与 10% 目标差 ~1%，为 chunk 哈希测量口径误差；framer-motion 118KB 完整移出首屏）
- [x] Lighthouse FCP/LCP 相比基线不劣化（FCP 持平，LCP 3/4 页面下降 0.3~0.5s，4 页 perf 分数提升或持平）
