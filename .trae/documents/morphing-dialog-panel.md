# 幻形对话系统（三面一体）实施计划

## Context

用户的痛点是：当前右侧对话抽屉是固定 `DRAWER_W=368` 的一条"细缝"，贴边又窄，很不方便。已确认方向：**保留右侧可拖动的对话抽屉为主力，叠加"灵动岛"与"追焦船台"两个辅助面**，并把对话内容从纯 Markdown 升级为"内容即组件"（文本与白名单生成组件在宽画布上交替混排）。

三面定位（用户确认）：
1. **右侧对话（主力）**：保留、可拖宽（440~640 + 展开档）、可展开；组件优先的内容舞台在这里。
2. **灵动岛 Dock（辅助）**：右侧收起时，底部一条灵动岛，主动给 AI 提示 / 预设或 Agent 生成的工作流快捷项；点击展开右侧。
3. **悬浮船台 Float（辅助 · 随焦点）**：根据用户当前聚焦的页面模块/`[data-agent-action]` 把手，浮出一块"船台"，提供"纳入对话上下文"动作并送进聊天。

范围：一次全做。无单测、不写 e2e（用户要求），以 `bun run dev` 手动走查 + `bun run build` 通关验证。

## 现状（已探明，直接复用）

- 全局状态：`stores/agent-presence.ts`（zustand `usePresence`），已有 `drawerOpen` / `liveActivity`。
- 全局挂载：`components/layout/app-shell.tsx` L59-62 挂 `AgentOrb` / `AgentDrawer` / `AgentPalette`。
- 右侧抽屉 `components/agent/agent-drawer.tsx`：本体 `fixed inset-y-0 right-0 z-[28]`，宽 `style={{width:DRAWER_W}}`（L818-826）；拖宽用 `framer animate()` 命令式改 `#app-main` 父列 `marginRight`（L637-652）；发消息走 `serializePageContext()`（L466）；`render_component`/`ui_action` 经 onToolCall；part 分派 L991-1165（text→`MarkdownMessage`，tool-render_component→`GeneratedComponent`）。
- 浮动入口 `components/agent/agent-orb.tsx`：球 `fixed bottom-6 right-6 z-[33]`，实时标签 `bottom-[26px] right-[74px]`，**SSE 连接在此建立**（`usePresence.connect()`）。
- 前端内核 `lib/kernel/index.ts`（Cordis Context，单例）：actions / components / pageContext 三插件。门面在 `lib/agent/ui-actions.ts`、`lib/agent/page-context.ts`。
- `page-context` 目前是**页面级**（route/title/snapshot/actions/state），无元素级焦点。
- 命令桥 `subscribeAgentCommand`（抽屉 L665-676）：`sendAgentCommand(prompt)` → `setDrawerOpen(true)` + `send(prompt)`，可直接复用。

## 改动清单

### A. 右侧抽屉：可拖宽 + 宽画布（面 1，最小风险，可独立交付）
- `stores/agent-presence.ts`：新增 `drawerWidth: number` + `setDrawerWidth(w)`（作 drawer 宽度与 margin-push 的单一真源，供 `panel.morph` 程序化触达）。默认值用常量（**不**在 SSR 里分支读 localStorage，防 hydration 不匹配）。
- `components/agent/agent-drawer.tsx`：
  - 档位 `SNAP_STEPS=[440,540,640]`，`EXPANDED_W=748`，`DEFAULT_W=540`，`MIN_W=440`，`MAX_W=640`。
  - 宽度从 store 读 `drawerWidth`（替换 `DRAWER_W` 常量），`style={{width}}` 与 margin-push（L639-652 换成 store 值并加依赖）。
  - 左边缘加拖宽把手（`pointerdown/move/up` + `setPointerCapture` + `preventDefault`，拖完 snap 到最近档位；位移 <8px 视为误触忽略；双击回默认）。`localStorage` 仅经 useEffect 读写快照档位。
  - "内容即组件"：`tool-render_component` 的渲染块去掉窄气泡 `max-w-[94%]` 约束，改 全宽 `w-full`，`GeneratedComponent` 大宽自适（charts/data-table 已数据驱动）。
- 窗口 <900px 时 `MAX_W` 用 `min(window.innerWidth, MAX_W)` 收敛。

### B. 灵动岛 Dock（面 2）
- 新增 `components/agent/agent-dock.tsx`：**替代并吸收 `AgentOrb`**（保留 SSE `connect()` + presence 响应 + toggle 职责）。
  - busy 态：显示 `liveActivity` 实时动作头条（继承原球旁标签价值）。
  - idle 态：显示预设工作流快捷项 + 可选 Agent 建议项（`dockSuggestion`）＋焦点联动项。
  - 快捷项统一 `{label,prompt}`，onClick → `sendAgentCommand(prompt)`（复用命令桥，零新增通道）；岛头点击 → `setDrawerOpen(true)`；抽屉打开时淡出。
  - 预设来源：`lib/journeys/registry` 的 `enabled` 旅程 + 内置 prompt 白名单。
- `components/layout/app-shell.tsx`：`AgentOrb` → `AgentDock`（沿用 `next/dynamic ssr:false`）。
- `stores/agent-presence.ts`：新增 `dockSuggestion?:{label,prompt,source}` + `setDockSuggestion`（供 `dock.suggest` 写入）。

### C. 追焦船台 Float（面 3）
- 新增 `lib/agent/use-focus-tracking.ts`（client hook）：单个 IntersectionObserver（root=null，threshold=[0,.25,.5,.75,1]）对 `main#app-main [data-agent-context]` 与 `[data-agent-action]` 做可见份额投票；取 share≥0.35 中份额最高者为 winner；批量回调 + debounce(~120ms)；观测上限 64；路由离开 disconnect+clear。结果写入 `focus`。坐标随 scroll 用 rAF 节流重读焦点元素 rect。
- `stores/agent-presence.ts`：新增 `focus: {module,label,rect?,annotatedAction?} | null` + `setFocus`/`clearFocus`。
- `lib/kernel/plugins/page-context.ts`：`PageAgentContext` 增加可选 `focusSnapshot?: ()=>string`，`useAgentPage` 支持 `focusTitles?: Record<string,string>`，把焦点模块 + `[data-agent-action]` 把手一并注入 chat。
- 新增 `components/agent/agent-float-dock.tsx`：`fixed` 锚定在焦点 elem rect 右上，视口内 clamp；`drawerOpen` 时隐藏（内容列被挤压会移位）；"纳入对话上下文"按钮 → `sendAgentCommand(prompt)`。
- `components/layout/app-shell.tsx`：挂 `AgentFloatDock`。
- 在 2-3 个关键模块容器试补 `data-agent-context`（如运营总览的指标卡、任务表格）。

### D. Agent 主动控面板（面 5，L0 纯 UI 形态）
- `lib/kernel/plugins/ui-actions.ts` `createGlobalActions()` 追加：
  - `panel.morph`：`{shape:enum['dock','float','drawer','compact','expanded'], width?, question?}`，execute 走 `usePresence.getState().setDrawerOpen/setDrawerWidth`，question 存在则命令桥送话。
  - `panel.expand`：`{}` → 切 `EXPANDED_W`。
  - `dock.suggest`：`{label,prompt}` → `setDockSuggestion`。

## 关键文件
- `stores/agent-presence.ts`（drawerWidth/focus/dockSuggestion + setter）
- `components/agent/agent-drawer.tsx`（宽度换源 + 拖把手 + 宽画布 full-bleed）
- `components/agent/agent-orb.tsx`（被替换为 dock）
- `components/agent/agent-dock.tsx`、`components/agent/agent-float-dock.tsx`（新增）
- `lib/agent/use-focus-tracking.ts`（新增）
- `components/layout/app-shell.tsx`（AgentOrb→AgentDock、挂 AgentFloatDock）
- `lib/kernel/plugins/ui-actions.ts`（panel.morph/panel.expand/dock.suggest）
- `lib/kernel/plugins/page-context.ts`（focusSnapshot + focusTitles）

## 约束与风险
- Next.js 16.2.6 破坏性变更：改前读 `node_modules/next/dist/docs/`；新组件一律 `'use client'` + `next/dynamic(ssr:false)`（沿用现有 orb/palette 模式）；store 默认固定常量、localStorage 仅 useEffect。
- 分层：UI 层禁止 import `lib/server/**`；只引入 stores / lib/kernel（UI 门面）/ lib/agent（客户端）/ lib/shared。
- 拖宽：setPointerCapture + preventDefault + user-select:none；拖动期间抽屉内 Input/ScrollArea `pointer-events:none`；margin-push 用 framer animate 已隔离两维。
- a11y：灵动岛 `role="toolbar"`/`aria-expanded`，`aria-live="polite"` 仅 live 用；船台不抢焦点、`aria-hidden` 装饰；全部动画尊重 `useReducedMotion()`。
- 性能：IO 上限 64 + 批量 debounce + 路由清理；rect 更新 rAF 节流只读焦点元素。

## 实现顺序与验证
1. **可拖宽**（面 1）：dev 拖宽看抽屉+内容列同步、snap/展开/记忆；build 通关。
2. **灵动岛**（面 2）：dev 触发一次 agent 动作看 busy 头条、idle 快捷项开抽屉送话；build。
3. **追焦船台**（面 3）：dev 滚动/切模块看船台跟随、"纳入上下文"送焦点进对话；build。
4. **auto-morph 动作**（面 5）：`bun run dev` 下经 `window.__agentUI.execute('panel.morph',{shape:'expanded'})` 走查切形态；build。
5. **打磨**：宽画布组件 full-bleed、"内容即组件"体验、a11y/性能护栏复查、无 `data-agent-*` 时船台自然降级。

每阶段完结跑 `bun run build` 通关（类型/边界/RSC 校验）。全程 `bun run dev` 手动走查，不写不跑 e2e。