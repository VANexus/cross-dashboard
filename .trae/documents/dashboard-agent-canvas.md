# 仪表盘 = Agent 动态画布 + 文案对标 Vercel/Supabase

## Context（为什么改）

用户以真实操盘手视角体验后反馈:

- **文案太"中二"、不像产品**,要对标 Vercel / Supabase 的克制、专业、中性语气。

- **仪表盘设计"拉垮"**——当前是硬编码的静态面板堆砌(协同拓扑/工作流DAG/心跳/AI实时任务流),`dashboard-stats.tsx` 的指标文案还出现"已完成任务 个 0 运行中"这类语义别扭。

- 核心愿景:**仪表盘是 Agent 的主舞台,UI 组件是 Agent 的副手(工具)**——"一切 Agent 动态决定展示什么,而不是写死几个无聊没用的东西"。

用户已确认方向:**"Agent 画布 + 保留状态条"** + **"文案对标 Vercel/Supabase"**。

现状基础(已探索确认):

- Agent 已能经 `render_component` client tool 动态生成 17 个白名单组件(`components/agent/generated/index.tsx` 的 `componentDefs`: stat-card / line-chart / bar-chart / area-chart / pie-chart / radar-chart / data-table / progress / timeline / tag-list / form / action-list / callout / video-scroll / question / ranking / compare / metric-grid),但**只渲染在右侧抽屉对话流里**。

- `app/p/[slug]/page-spec-renderer.tsx` 已有"组件 spec → 查表 → zod 校验 → 渲染到页面主体"的权威模式可复用。

- `stores/agent-presence.ts`(zustand)管理在场状态,有 `set*` action;`lib/kernel/plugins/ui-actions.ts` 的 `createGlobalActions` 提供 Agent 可调 UI action。

- 全仓只有 `app/dashboard` 使用 `DashboardShell` 的 `cockpit` prop(Plan agent 已 rg 确认)。

## 目标形态

```
仪表盘 =
  顶部紧凑状态条(保留)   ← StatsIsland compact:KPI / 心跳 / 告警,文案专业
  Agent 动态画布(主区)    ← 由 Agent 经 panel.pin 固定的组件;空态给克制引导
```

Agent 能主动把"已生成的组件"pin 到主画布,长期保留(刷新不丢);用户可点 X 移除。移除全部写死的大面板(拓扑/工作流DAG/心跳列表/AI实时任务流)。

## 实现步骤

### 1. 画布状态 — `stores/agent-presence.ts`

新增类型与 store 字段/action(沿用 zustand `create<PresenceState>`):

- `interface CanvasItem { id; component; props; title?; pinnedAt }`

- `canvas: CanvasItem[]`(初始 `[]`,避免 SSR 水合不一致)

- `pinCanvasItem(item)` / `unpinCanvasItem(id)` / `setCanvas(items)` / `clearCanvas()`

- 持久化:常量 `CANVAS_STORAGE_KEY = 'flowmind.dashboardCanvas'`,统一一个 `persist(items)` 助手写 localStorage(`typeof window` 守卫 + try/catch)。**localStorage 恢复放在 DashboardCanvas 的 mount effect,不放 store 初始化**(store 服务端求值碰不到 localStorage)。store 只当纯数据容器,不做校验(渲染层防御)。

### 2. pin action — `lib/kernel/plugins/ui-actions.ts`

在 `createGlobalActions` 新增两个 **L0** 动作(只读/本地 UI 状态,天然可逆):

- `panel.pin`: schema `{ component, props?, title? }`。execute: `getClientKernel().components.getComponent(id)` 查白名单 → `def.propsSchema.safeParse(props)`(与 render\_component 同一道校验)→ 生成稳定 id `pin-${component}-${timestamp36}` → `usePresence.getState().pinCanvasItem(...)` → 返回"已固定到主画布"。

- `panel.unpin`: schema `{ id?, component?, title? }`。按 id 或 component+title 首个匹配移除。

- 动作经 `createGlobalActions` 注册后,由 `page-context.ts` 的 `serializePageContext()` 自动纳入 LLM 动作清单,**无需改 chat route / system prompt**。

### 3. 新增 `app/dashboard/dashboard-canvas.tsx`(client)

- 订阅 `usePresence((s) => s.canvas)`;mount effect 从 `CANVAS_STORAGE_KEY` 恢复(`setCanvas`)。

- 渲染 `grid grid-cols-1 md:grid-cols-2 gap-4`;每个 item 包 `CanvasTile`(标题 + 右侧 X 移除 → `unpinCanvasItem`)。

- 组件渲染:复用 `componentDefs.find(d => d.id === item.component)`;不存在或 `safeParse` 失败 → 渲染降级块(虚线框 + 移除按钮),**不崩整屏**。窄组件(stat-card/metric-grid/compare)半宽,图表/表格/时间线整行(`md:col-span-2`),对齐 page-spec-renderer 布局。

- 空态(克制引导,Vercel 语气):主文案「画布为空。让 Agent 生成图表、表格或指标后,组件会自动固定到这里。」+ 副文案「示例:「分析今日工作流,把趋势图放到仪表盘」」+ 按钮「打开助手」(`setDrawerOpen(true)`,保留 `data-agent-action="orchestrate"` 供 click 动作把手)。

### 4. 仪表盘改造 — `app/dashboard/page.tsx` + `dashboard-shell.tsx` + `loading.tsx`

- `page.tsx`: 去掉 `cockpit-grid`/`cockpit-panel` 结构,只渲染 `<StatsIsland compact />` + `<DashboardCanvas />`;删除 `TopologyIsland/WorkflowTopologyIsland/WorkflowsIsland/HeartbeatIsland/AiLivePanel` import 与渲染(island 文件保留在磁盘,不删)。文件 doc 注释中性化。

- `dashboard-shell.tsx`: 移除 `cockpit` prop、`AiLivePanel` 渲染、**移除挂载自动开抽屉 effect**(克制,改为画布空态按钮手动打开);`useAgentPage` 增 `state: () => ({ canvas: usePresence.getState().canvas.map(...) })` 让 Agent 感知画布现状避免重复 pin。

- `loading.tsx`: 只保留 KPI 骨架 + 画布骨架,删大面板骨架。

### 5. 文案打磨(对标 Vercel/Supabase:中性、短句、无 emoji、无感叹)

| 位置                             | 现值                         | 替代                               |
| ------------------------------ | -------------------------- | -------------------------------- |
| dashboard-shell description    | 多智能体协同编排 · 内容工作台总览         | 工作流、内容与 Agent 状态的实时总览            |
| dashboard-shell 右上角            | 实时数据 · 本地编排                | 实时数据                             |
| dashboard-shell 按钮             | 发起编排                       | 打开助手                             |
| dashboard-stats                | 心跳正常                       | 运行正常                             |
| dashboard-stats                | 需处理                        | 待处理                              |
| dashboard-stats                | 无风险                        | 无告警                              |
| dashboard-heartbeat MOOD\_META | emoji 前缀(🎯专注/🔍好奇 等)      | 去 emoji,仅留标签,用色点表达               |
| dashboard-heartbeat            | 正在读取真实心跳数据…                | 正在读取心跳数据…                        |
| command.ts manifest            | label 指挥台 / desc 全局运营总览…   | label 工作台 / desc 运营总览:KPI 与工作流状态 |
| agent-drawer header            | Agent 视域                   | Agent 助手                         |
| agent-drawer                   | 流式执行中 · 湍流升高 / 直播中 / 等待事件… | 执行中 / 实时 / 暂无事件                  |
| 画布空态(新增)                       | —                          | 见步骤 3                            |

> 注意:保留 `data-agent-action="orchestrate"` 数据属性(仅改可见文案),避免破坏 `click`/`fill` 的稳定选择器把手。

### 6. E2E 同步 — `e2e/dashboard.spec.ts`

- 删除对已移除面板(Agent 动态工作流 / 心跳 / 协同拓扑 / AI 实时任务流 / cockpit-grid / 自动开抽屉)的断言。

- 新增:KPI 状态条可见、画布空态可见、经 `window.__agentUI.execute('panel.pin', {component, props})` 后画布出现组件且刷新后仍在(localStorage)。

### 7. 可选(低优先,依实现进度取舍)

- `lib/server/agent/chat-context.ts` BASE\_PERSONA 加一句 panel.pin 用法引导。

- `app/dashboard/dashboard-ai-live.tsx` 移出页面后,按项目"遗留代码可安全删除"惯例删除。

- `app/globals.css` 中 cockpit CSS 块清理(若不再使用)。

## 复用(不新造)

- `components/agent/generated/index.tsx` 的 `componentDefs` + `propsSchema`(渲染 + 校验)

- `lib/kernel/plugins/component-kit.ts` 的 `ComponentKitService`(`getComponent`/`listComponents`)

- `stores/agent-presence.ts` zustand store(画布状态载体)

- `lib/kernel/plugins/ui-actions.ts` 的 `ActionsService.runAction` / `createGlobalActions`

- `app/p/[slug]/page-spec-renderer.tsx` 的"查表 → safeParse → render"防御模式

## 关键文件

- 修改:`stores/agent-presence.ts`、`lib/kernel/plugins/ui-actions.ts`、`app/dashboard/page.tsx`、`app/dashboard/dashboard-shell.tsx`、`app/dashboard/loading.tsx`、`app/dashboard/dashboard-stats.tsx`、`app/dashboard/dashboard-heartbeat.tsx`、`lib/workspaces/manifests/command.ts`、`components/agent/agent-drawer.tsx`、`e2e/dashboard.spec.ts`

- 新增:`app/dashboard/dashboard-canvas.tsx`

## 验证

1. `bunx tsc --noEmit` 零错误。
2. dev server(`bun run dev`)确认 `/dashboard`:顶部状态条可见 + 画布空态引导可见,不再有拓扑/心跳大面板。
3. 控制台 `window.__agentUI.execute('panel.pin', { component:'stat-card', props:{ title:'测试', value:1 } })` → 画布出现 stat-card;刷新后仍在(localStorage);点 X 可移除。
4. 打开助手 → 对话里让 Agent"把今日工作流趋势图放到仪表盘",确认 Agent 能调 panel.pin 且画布出现图表。
5. `bun run test:e2e -- e2e/dashboard.spec.ts` 通过(已同步的新断言)。
6. 侧边栏导航:确认「工作台」入口 label 更新、B 端运营分组不受影响。

