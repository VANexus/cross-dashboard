# Agent 三面一体动画架构重构

## Context（背景）

右侧「Agent 面板」三面一体（灵动岛 dock ⇄ 侧栏 sidebar ⇄ 近全宽舞台 stage）经过多轮 bug 修复后已无状态残留问题，但**动画丝滑度被牺牲**：

- 为防「路由切换打断 GSAP 动画导致抽屉残留」bug，用了 React `invisible` 铁保底 + `ResizeObserver` 即时 `gsap.set` 挤压 main。

- 结果是打开/切换时 main 挤压不再有平滑动画（instant set），收起时面板本体被 invisible 立即隐藏，只剩 ghost 收拢——整体变生硬、不丝滑。

- 面板的 transform、width、main 的 margin、FLIP ghost 由**多个零散 effect 各管各的**（[agent-drawer.tsx](file:///x:/xrak/yuz/cross-dashboard/components/agent/agent-drawer.tsx) 的 surface exchange / width / margin 三个 effect），属性间无统一协调，难以同步。

**目标**：以 **GSAP 单一 timeline 统一编排每次表面切换**，让 aside 淡入淡出 + width + main 挤压 + FLIP ghost 原子化同步，做到丝滑；同时保留「dock 态由 React 铁保底」消除残留。

**已与用户确认的取向**：

1. 保留近全宽舞台（stage ≈ 1200px，切换宽度用 GSAP 过渡）。
2. 收起动画接受「ghost 形变主导、面板本体快速隐藏」的保底策略。

## 架构设计

### 核心原则

- **React 状态是真源**：`surface` / `drawerWidth` / `stageOpen` 决定目标态。

- **GSAP timeline 统一驱动**：每次 `surface` 变化，用**一个** `gsap.timeline` 协调 aside transform/width + margin 挤压 + ghost 形变，保证同步丝滑。

- **dock 态保底**：aside 挂 `invisible pointer-events-none`（React 级铁隐藏，杜绝残留）。收起动画由 ghost 收拢主导，不依赖 aside 本体可见性。

### 状态 → 目标

| surface | aside 位置                     | aside 宽度                 | main margin   |
| ------- | ---------------------------- | ------------------------ | ------------- |
| dock    | 屏外（xPercent 110 + invisible） | 档位                       | 0             |
| sidebar | 屏内                           | drawerWidth（440/540/640） | drawerWidth   |
| stage   | 屏内                           | stageW（≈1200）            | 0（覆盖 + scrim） |

## 实现步骤（主要改 `components/agent/agent-drawer.tsx`）

### 1. 新增统一协调函数 `animateSurface(prev, next)`

用 `gsap.timeline()` 编排，替代现有零散的 surface exchange / width / margin 三个 effect 的职责：

- **margin 用 proxy 对象补间**（丝滑挤压）：

  ```ts
  const marginProxy = useRef({ v: 0 });
  // timeline 内：
  .to(marginProxy.current, { v: target, duration: 0.5, ease: 'expo.out',
       onUpdate: () => column && gsap.set(column, { marginRight: marginProxy.current.v }) })
  ```

- **打开（dock → sidebar/stage）**：`fromTo(aside, {x:48, opacity:0} → {x:0, opacity:1})` + width 补间 + margin 挤压 + `morphGhost(ghost, dockRect, panelRect)`（岛生长）。

- **收起（→ dock）**：`to(aside, {x:56, opacity:0})` + margin 归零 + `morphGhost(ghost, islandAnchorRect(), panelRect, {reverse:true, onComplete:...})`（收拢主导）。

- **切换（sidebar ↔ stage）**：width 补间 + margin（stage→0 / sidebar→drawerWidth）+ scrim，无重入场。

- `reduce`（无障碍减少动效）时全部 `gsap.set` 直达终态。

### 2. 收敛三个零散 effect

- **surface exchange effect（L641-701）**：改为调用 `animateSurface(prev, next)`（用 `prevSurfaceRef` 记 prev）。

- **margin ResizeObserver effect（L610-635）**：改为**只在** **`resizing`** **时**即时 set margin 跟随 aside 宽度；动画期 margin 由 timeline 驱动，二者不冲突。保留 dashboard 沉浸式强制归零。

- **width effect（L705+）**：宽度补间并入 timeline；**移除独立 effect**。拖动即时逻辑移入 `onMove`（`gsap.set(aside,{width})` + `gsap.set(column,{marginRight})`）。

### 3. 保底保留（防残留，不动）

- aside className 保留 `surface === 'dock' && 'invisible pointer-events-none'`。

- mount `useLayoutEffect` 初始 `xPercent:110` 屏外。

- 可移除 380ms dock 兜底 effect（`invisible` 已铁保底）。

### 4. 复用现有基建（不重写）

- `lib/agent/surface-morph.ts` 的 `morphGhost` / `takeDockRect` / `islandAnchorRect` 原样复用。

- `stores/agent-presence.ts` 的 `setSurface` 状态机不动。

- dashboard 沉浸式（`dashboardImmersive` return null + 双向 dock 归一）不动。

## 验证

1. `bunx tsc --noEmit -p tsconfig.json` 确认 agent-drawer 无类型错误。
2. 浏览器（browser\_use）逐项验证：

   - **打开**：dock → sidebar，aside 淡入 + ghost 从岛生长 + main 平滑挤压（margin 与 aside 宽度同步补间）。

   - **切换**：sidebar → stage → sidebar，宽度 expo 过渡 + margin 同步（stage 归零、sidebar 回归）。

   - **收起**：→ dock，ghost 收拢回岛 + margin 归零，结束后 aside 隐藏、无残留。

   - **拖动**：调宽全程即时跟手，margin 与宽度一致。

   - **路由**：dashboard ⇄ 其他页反复切换，无抽屉残留（dock 态 invisible 保底）。

   - **dashboard**：沉浸式页仍只有顶部灵动岛，无面板。
3. 确认无回归：dock 快捷项打开面板、ESC 逐级退出、命令总线唤醒侧栏均正常。

