# Checklist

- [x] Python 后端 (port 8000) 可正常启动并响应 /health
- [x] Next.js 前端 (port 3000) 可正常启动
- [x] `pnpm exec playwright test` 全部通过（67/67 passed, 0 failures）
- [x] dashboard.spec.ts: Suspense 骨架屏→数据、统计卡片、工作流表格、告警列表均验证通过
- [x] agents.spec.ts: Agent 卡片加载、详情页动态路由、状态指示器均通过
- [x] tasks.spec.ts: 任务列表、搜索过滤、状态筛选均通过
- [x] risk.spec.ts: 健康评分、风险事件、隔离清单均通过
- [x] memory.spec.ts: 记忆条目、类型筛选、搜索均通过
- [x] evolution.spec.ts: 进化记录、阶段筛选、趋势指标均通过
- [x] workflows.spec.ts: 6 个工作流页面独立加载、数据渲染均通过
- [x] navigation.spec.ts: 侧边栏导航、404 处理、根路径重定向均通过
- [x] rsc-features.spec.ts: Suspense 流式渲染、动态路由、全链路数据验证均通过
- [x] 所有页面数据来自 Python 后端（非前端硬编码）
