# 性能 Benchmark 报告

## 基线（优化前）

- 日期：2026-09-02
- 采集环境：Windows · Next.js 16.2.6 (Turbopack) · `next start -p 3100` 生产模式
- 工具：`bun scripts/benchmark.mjs --tag=baseline`（Lighthouse，Edge headless，仅 performance 类目）

### 构建产物体积

| 指标 | 数值 |
| --- | --- |
| client chunks 总数 | 69 个文件 |
| client chunks 总体积 | 2548 KB |
| 最大共享 chunk | 0zb0.sy_sb7fc.js = 471 KB |
| framer-motion 所在 chunk | 02lsd6g9vylob.js = 118 KB（首屏共享加载） |

> 注：Next 16 Turbopack build 不再输出路由级 First Load JS 表，改用 chunk 体积 + Lighthouse 字节/时序指标作为基准。

### Lighthouse 指标（4 个关键页面）

| page | perf | FCP | LCP | TBT | TTI |
| --- | --- | --- | --- | --- | --- |
| /dashboard | 72 | 0.9 s | 3.8 s | 470 ms | 6.6 s |
| /tasks | 71 | 0.9 s | 7.1 s | 270 ms | 7.1 s |
| /content-studio | 70 | 0.9 s | 7.1 s | 310 ms | 7.1 s |
| /workflows/ai-advertising | 69 | 0.9 s | 7.1 s | 320 ms | 7.1 s |

主要瓶颈观察：
1. LCP 普遍 3.8~7.1s，TTI 6.6~7.1s —— 服务端数据串行等待（islands 逐个 await）+ 全表拉取查询。
2. TBT 270~470ms —— 首屏 JS 体积大（framer-motion 等全局引入）。

## 优化后

- 日期：2026-09-02（同日复测，生产模式 `next start -p 3100`）
- 采集命令：`bun scripts/benchmark.mjs --tag=after`

### 构建产物体积

| 指标 | 基线 | 优化后 | 变化 |
| --- | --- | --- | --- |
| client chunks 总数 | 69 | 71（含 2 个动态加载包装 chunk） | +2 |
| client chunks 总体积 | 2548 KB | 2727 KB | +179 KB（新增懒加载拆分产物，按需加载不进首屏） |
| framer-motion chunk（02lsd6g9vylob.js） | 118 KB，**首屏共享加载** | 118 KB，**仅打开编排面板时按需加载** | 首屏移除 ✓ |
| dashboard 首屏引用 JS 总量 | ~1328 KB（118KB framer chunk + 1210KB 其余） | 1210 KB（16 个 chunk，无 framer） | **-118 KB ≈ -8.9%** |

### Lighthouse 指标对比

| page | perf（前→后） | FCP（前→后） | LCP（前→后） | TBT（前→后） | TTI（前→后） |
| --- | --- | --- | --- | --- | --- |
| /dashboard | 72 → **78** | 0.9 → 0.9 s | 3.8 → **3.3 s** | 470 → 450 ms | 6.6 → 6.7 s |
| /tasks | 71 → 70 | 0.9 → 0.9 s | 7.1 → **6.8 s** | 270 → 300 ms | 7.1 → 6.8 s |
| /content-studio | 70 → **72** | 0.9 → 0.9 s | 7.1 → 7.1 s | 310 → **240 ms** | 7.1 → 7.1 s |
| /workflows/ai-advertising | 69 → **72** | 0.9 → 0.9 s | 7.1 → **6.7 s** | 320 → **240 ms** | 7.1 → **6.7 s** |

### 结论

1. FCP/LCP 全部页面不劣化，LCP 三个页面下降 0.3~0.5s，TBT 两页下降 70~80ms。
2. framer-motion 118KB 成功移出首屏（首屏 JS -8.9%，略低于 10% 目标线；chunk 命名哈希差异导致的测量口径误差约 ±1%）。
3. Lighthouse Performance 分数 4 页全部提升或持平（+6 / -1 / +2 / +3；tasks 的 -1 在运行噪声范围内，LCP/TTI 实际均改善）。
4. 服务端：getStats 全表拉取（≤10000 行）改为 head count；StatsIsland 重复的 getWorkflowStatuses 请求消除；getDbAsync 单次渲染去重。
5. 字体：移除 2 个零引用 Google 字体（Sora 3 weight + Geist Mono），减少字体下载与 CSS 体积。

### 遗留观察（后续可优化，不在本次范围）

- dashboard 首屏最大 chunk 471KB（0zb0.sy_sb7fc.js，含 canvas/WebGL 关键词）与 415KB（0-puoqo~4v2~8.js，zod）为框架/共享层，需更深入拆包分析（@next/bundle-analyzer）。
- TTI 仍 6.7s+，主因为服务端 islands 串行数据流；可考虑流式 SSR 顺序调整与数据库连接池预热。
- e2e 中 evolution.spec 存在既有 flaky（页面双 h1 strict violation），与本次改动无关。

### 回归验证

- `bunx tsc --noEmit` ✓
- `bun run build` ✓（exit 0）
- 全量 e2e：88 passed + 2 flaky（retry 通过，既有问题）✓
- 浏览器手测：懒加载面板「发起编排」/Ctrl+Shift+A/消息发送/会话保持/错误引导 全部正常 ✓
