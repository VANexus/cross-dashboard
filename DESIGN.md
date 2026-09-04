# DESIGN.md — FlowMind 前端设计与交互规范

> 适用范围：`app/`、`components/`、`islands/`、`hooks/` 下一切用户可见的页面、组件、动效与样式。
> 本文是**视觉与交互的唯一裁决标准**；架构分层、数据流、目录职责以 `AGENTS.md` 与 `docs/architecture/` 为准，本文不重复、不越界。
>
> **四条总纲（优先级从上到下）**
> 1. **GSAP 优先**：新增动画默认 GSAP，其余方案只在本文允许的边界内使用。
> 2. **Linear / Vercel / Neon 级**：所有界面以这三家产品的完成度为验收基线，而不是「能用就行」。
> 3. **shadcn 级组件规范**：原子组件达到 shadcn/ui 的可组合、可访问、无业务程度。
> 4. **现成库优先**：能用已有依赖和成熟库解决的，绝不手写第二套。

---

## 1. 设计语言与对标

项目设计语言（见 `app/globals.css` 文件头）：**SpaceX Industrial + Apple Minimal**——工业级信息密度 + 苹果级克制取舍。三家对标分别管三件事：

| 对标 | 我们取什么 | 落地表现 |
|---|---|---|
| **Linear** | 信息密度、层级秩序、键盘流的爽感 | 13px 紧凑正文、surface 三层、hairline 分割、列表 hover 即反馈、⌘K 可达一切 |
| **Vercel** | 黑白灰克制、几何精确、工程化审美 | Geist 字体、数字 tabular-nums、单一中性阶打底、圆角/间距精确到 4px 栅格、零多余装饰 |
| **Neon** | 深色空间感、状态即颜色、克制的发光 | dark 主题同等打磨、语义色只点状态、glow 只用于运行态（心跳/脉冲/流光线），不用于装饰 |

### 1.1 完成度验收基线（达不到不许合并）

- **层级不靠猜**：任意相邻两个面，必须能通过「底色阶差 + 1px hairline 边框」区分；重阴影只属于悬浮层和弹层。
- **密度一致**：同层级卡片内边距、行高、控件高度全站一致，不允许相邻页面两套手感。
- **动效有理由**：每段动画必须服务于「入场层级 / 操作反馈 / 空间关系」之一，否则删掉。首屏入场 1s 内结束且不阻塞操作。
- **双主题等价**：light / dark 都要单独验收，dark 不是简单反色（见 §2.4）。
- **静态也成立**：关掉动画、加载失败、数据为空三种状态下布局不塌、信息不丢。

---

## 2. Token 体系（唯一真源：`app/globals.css`）

本项目 **Tailwind CSS v4，没有 `tailwind.config.*`**。Token 定义在 `:root` / `.dark`，经 `@theme inline` 映射为工具类。**新增/修改 token 只能改 `globals.css`，禁止在组件里造平行变量。**

### 2.1 颜色

| 类别 | Token | 用途 |
|---|---|---|
| 中性基底 | `background` `foreground` `card` `popover` `secondary` `muted` `accent` | 文字与容器，OKLCH 中性灰阶，不允许自带色相 |
| 主行动 | `primary` / `primary-foreground` | 唯一主按钮、当前选中、关键强调；一页最多一个视觉主色焦点 |
| 语义 | `success` `warning` `info` `destructive` | 只表达状态，不做装饰 |
| 表面层级 | `surface-0` / `surface-1` / `surface-2` | 底 → 卡 → 卡内嵌套，见 §2.2 |
| 数据可视化 | `viz-1 … viz-8` | 图表系列色，顺序使用、多图表保持同指标同色 |
| 六大工作流 | `wf-product` `wf-imaging` `wf-ad` `wf-listing` `wf-inventory` `wf-competitor` | 工作流身份色，仅用于工作流相关的 rail/徽章/图表 |
| 品牌专色 | `brand-wechat`（微信绿）、`price`（TikTok 价粉） | 仅对应业务语境 |
| 柔色背景 | `gradient-success` `gradient-warning` | 审计卡等柔色底，不做大面积铺陈 |

取色规则：需要透明/混合时用 `color-mix(in oklch, var(--token) N%, transparent)`，这是全站既有做法（hover、soft 背景统一照此）。

### 2.2 表面层级与阴影（Linear 式层次）

- 层级抬升**优先用底色阶差**（surface-0→1→2）+ 1px `border`（light：中性灰；dark：`oklch(1 0 0 / 10%)` 发丝线）。
- 阴影只有三档，禁止自写 box-shadow：
  - `--shadow-card`：常态卡片（几乎不可察）；
  - `--shadow-raised`：悬浮卡片、下拉、hover 抬升；
  - `--shadow-overlay`：Dialog / Sheet / 命令面板等遮罩层。
- `.glass` / `.glass-surface` 在当前语言下**就是干净卡片**（毛玻璃已废弃），不要再加 `backdrop-filter`。

### 2.3 字体、字号、圆角、间距、布局

- **字体**：Geist Sans / Geist Mono，由 `app/layout.tsx` 的 `next/font` 注入 `--font-geist-*`；标题 `--font-sans`，指标/时间/ID/代码 `--font-mono`。
- **字号阶梯**（禁止 `text-[13px]` 类任意值，token 已覆盖）：

  | Token |  rem | 用途 |
  |---|---|---|
  | `text-tiny` | 10px | 微型标注、坐标轴 |
  | `text-caption` | 11px | 辅助说明、时间戳 |
  | `text-body` | 13px | 紧凑正文（默认密度） |
  | 正文/标题 | 14 / 15 / 16 / 26 | 面板正文 14-15、区块标题 15-16、页头 H1 26 |

  标题负字距：H1/大数字 `-0.02em ~ -0.03em`。所有数值加 `tabular-nums` 或直接用 `.metric-value`。
- **圆角**：基准 `--radius: 0.625rem`（sm/md/lg/xl 由其派生）；**卡片统一 `rounded-card`（20px）**；胶囊用 `rounded-full`；同一卡片内元素圆角小于卡片本身。
- **间距**：4 的倍数；面板内边距 20-22、卡片 16-20、行内 gap 6-10、卡片间 gap 18，沿用 `dash-*` 既有尺度。
- **布局常量**：侧栏 248px / 折叠 64px、顶栏 52px；页面内容统一套 `.page-container`（max-width 1200、水平留白 `clamp(16px,3vw,32px)`），不要各页自写 max-width。

### 2.4 双主题规则

- 任何新颜色**必须同时给 `:root` 与 `.dark` 两档值**，dark 下：边框改白透明、surface 阶差反向提亮、阴影加深、语义色提亮（参照现有 success/warning/info 与 viz 色板的 dark 值）。
- 主题切换由 `next-themes` + `components/providers/theme-provider.tsx` 承载，组件内禁止写死 `bg-white`/`bg-black`/`text-gray-xxx`。

### 2.5 动效 Token

| Token | 值 | 用途 |
|---|---|---|
| `--dur-fast` | 150ms | hover、press、颜色/边框过渡 |
| `--dur-base` | 250ms | 面板进出场、列表状态变化 |
| `--dur-slow` | 420ms | 页面/区块入场 |
| `--ease-out` | cubic-bezier(0.16,1,0.3,1) | CSS transition 默认曲线 |
| `--ease-out-quart` | cubic-bezier(0.25,1,0.5,1) | 入场减速，等价 GSAP `power3.out` 手感 |

---

## 3. 组件规范（shadcn/ui 级）

### 3.1 三层分工

| 层 | 目录 | 约束 |
|---|---|---|
| 原子组件 | `components/ui/` | **零业务、零 fetch、零硬编码文案**；可在任意项目复用；样式只吃 token 与 props |
| 业务组件 | `components/<domain>/`（agent、layout、orchestrator 等） | 组合原子件，承载业务状态 |
| 服务端装配 | `islands/*-island.tsx` | RSC 取数 → props 下传，遵循 `AGENTS.md` 页面结构模式 |

UI 层（components/hooks/stores/lib/kernel/lib/ui）**禁止 import `lib/server/**`**（eslint `no-restricted-imports` 已强制）。

### 3.2 获取组件的顺序（现成库优先在组件层的落地）

1. 先用 `components/ui/` 现有件（当前 30+：button/card/dialog/select/tabs/command/sonner/data-table…）。
2. 缺什么优先 `bunx shadcn@latest add <name>`（本仓 style 固定 `radix-nova`、baseColor `neutral`、图标 `lucide`，不许换风格）。
3. 官方没有再走已注册 registry，优先级：**`@originui` → `@magicui` → `@kibo`**（见 `components.json`）；引入前确认其 token 可被本仓变量替换。
4. 交互原语一律 **Radix UI**（已装全家桶）：Dialog / DropdownMenu / Popover / Select / Tabs / Tooltip / ScrollArea / Switch / HoverCard / Progress / Separator / Avatar 等，**禁止手写弹层、下拉、tooltip、焦点管理**。
5. 以上都没有，才允许自己写原子件，并按 §3.3 模板写。

### 3.3 原子件编写铁律

以 `components/ui/button.tsx` 为范本，缺一不可：

1. `React.forwardRef` 透传 ref，设置 `displayName`；
2. 变体用 **cva**（`class-variance-authority`），合并类名一律走 **`cn()`**（`lib/utils`，内含 tailwind-merge）；
3. 支持 **`asChild` + Radix `Slot`**，保证可换标签/嵌套链接；
4. 状态完备：`disabled`、`focus-visible:ring-2 ring-ring`、`active:` 按压反馈、hover 只动 token 色；
5. 变体命名沿用既有词表：variant = `default / secondary / outline / ghost / destructive / link`；size = `sm / default / lg / icon / icon-sm`，新语义先对齐词表再扩充；
6. 只允许 `"use client"` 到确实需要交互/状态的最小组件；纯展示件保持 RSC 安全。

参考骨架：

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const thingVariants = cva(
  "inline-flex items-center gap-2 rounded-lg text-body transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
  {
    variants: {
      variant: { default: "bg-primary text-primary-foreground", ghost: "hover:bg-accent" },
      size: { default: "h-9 px-3", icon: "h-9 w-9" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ThingProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof thingVariants> { asChild?: boolean; }

const Thing = React.forwardRef<HTMLDivElement, ThingProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return <Comp ref={ref} className={cn(thingVariants({ variant, size }), className)} {...props} />;
  }
);
Thing.displayName = "Thing";
export { Thing, thingVariants };
```

### 3.4 图标与微交互

- 图标库**只允许 `lucide-react`**，禁止引入第二套；常规尺寸 14（行内）/16（标题、按钮），stroke 粗细默认。
- hover 邀请点击的两种标准做法（二选一，不叠加）：边框 `color-mix(... primary 30%, border)`（见 `.workflow-card` / `.glass-hover`），或背景 `var(--accent-ghost)`（见 `.dash-wf-row:hover`）。
- 按压：`active:scale-[0.98]`；禁止弹性/果冻/3D 翻转。
- 焦点：任何可交互元素必须可见焦点环（`ring-2 ring-ring`），Radix 组件已自带键盘导航，不许破坏。

---

## 4. 动效规范（GSAP 优先）

### 4.1 选型决策树（新增动效照此裁决）

| 场景 | 指定方案 | 备注 |
|---|---|---|
| 时序编排、进出场、stagger、滚动触发、数值/属性补间、SVG/Canvas 时间线 | **GSAP（默认首选）** | 见 §4.3 模板 |
| 布局 FLIP、`layoutId` 共享元素、与组件 state 强绑定的小型声明式动画 | framer-motion（边界内允许） | 见 §4.2 |
| 数字滚动/计数 | `@number-flow/react`（`components/ui/animated-number.tsx` 已封装） | 禁止手搓 rAF count-up |
| hover/active 等 CSS 伪类微交互、无限循环装饰（pulse/shimmer/blink/beat/flow） | CSS（`globals.css` keyframes / `tw-animate-css`） | 不为此启动 JS 动画引擎 |
| 页面级淡入上移 | 优先复用 `.stagger-in` / `.dash-rise` / `PageTransition` | 三选一，不重复造 |

### 4.2 framer-motion 的边界（存量保留，新增受限）

framer-motion 已在 `agent-orb`、`agent-drawer`、`page-transition`、`tasks-client` 中使用，**这些文件内允许继续维护**。除此之外：

- 新增时序型/编排型动画一律 GSAP，不得新写 `motion.*` 做同样的事；
- 仅当确属 FLIP/共享布局或声明式成本显著更低时可用 framer-motion，并在 PR 说明一句话理由；
- 同一组件内 GSAP 与 framer-motion 不得同时控制同一元素。

### 4.3 GSAP 使用标准

**依赖**：统一使用 `useGSAP`（首次使用时 `bun add @gsap/react`，包管理器只能用 Bun）。

**标准参数（与全站 token 对齐，不要自创节奏）**

- 时长：微反馈 0.15-0.2s、组件进出场 0.2-0.24s、区块/页面入场 0.35-0.45s；
- 入场缓动 `power3.out`，退场 `power2.in`（与 `agent-palette`、`journeys` 现状一致）；
- stagger 间隔 0.04-0.08s（列表入场现状 0.06）；
- 禁用 back / elastic / bounce 类缓动，保持工业克制。

**标准模板**

```tsx
"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export function ThingList({ items }: { items: Item[] }) {
  const rootRef = useRef<HTMLUListElement>(null);

  useGSAP(() => {
    // 1) reduced-motion 必须降级为直接落位
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set("[data-animate='item']", { autoAlpha: 1, y: 0 });
      return;
    }
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.fromTo(
      "[data-animate='item']",
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.06, clearProps: "all" }
    );
  }, { scope: rootRef });   // 2) scope 自动 cleanup，卸载即还原，杜绝泄漏

  return (
    <ul ref={rootRef}>
      {items.map((it) => <li key={it.id} data-animate="item">…</li>)}
    </ul>
  );
}
```

**硬性要求**

1. **目标选择器用 `data-animate` / `data-*` 钩子**，不用结构性 class、不依赖 `nth-child`（同时利于 Playwright 选择器稳定）；
2. 显隐统一用 `autoAlpha`（不是 `display`/`visibility` 手切）；一次性入场结束 `clearProps: "all"`，把样式还给 CSS；
3. 必须处理 `prefers-reduced-motion: reduce`：`gsap.set` 直接落位（现有 `agent-palette` 即此模式，照抄判断）；
4. 滚动驱动用 ScrollTrigger，在模块顶层 `gsap.registerPlugin(ScrollTrigger)` 注册一次；
5. **只允许动画 `transform`（x/y/scale/rotation）与 `opacity`**；禁止补间 `width/height/top/left/margin/padding`（引发布局抖动），需要展开收起用 `autoAlpha`+y 或 FLIP 思路；
6. 动画时间线内禁止 `setState` 轮询驱动；循环动画（运行态脉冲）组件不可见时必须 `kill`/暂停；
7. 暂未引入 `@gsap/react` 的存量文件维持 `useEffect` + 手动 cleanup 写法，改动到该文件时顺手迁移。

### 4.4 动效性能与数量

- 单屏同时动画元素建议 ≤ 20；列表长于 50 行时入场只做容器淡入或虚拟滚动（`@tanstack/react-virtual`）后分批 stagger。
- `will-change` 只在动画即将发生时加、结束即除（NumberFlow 等库内建的除外），不要写进静态 class。
- 尊重帧率：动画期间不做同步大计算；数据更新走 SWR 缓存，不与入场动画抢主线程。

---

## 5. 现成库优先（能力地图，已装即用）

**裁决顺序：`components/ui` 现成件 → 下表已装库 → shadcn/registry → 新增成熟库 → 才允许手写。** 新增库须满足：React 19 / Next 16 兼容、SSR 安全、维护活跃、体积可接受，并用 **`bun add`**（禁止 npm/pnpm/yarn）。

| 能力 | 指定库（已在 package.json） | 禁止手写 |
|---|---|---|
| 基础交互原语 | `@radix-ui/react-*` / `radix-ui` | 自造 modal、popover、select、tooltip、菜单焦点管理 |
| 类名合并/变体 | `clsx` + `tailwind-merge`（`cn`）、`cva` | 手写字符串拼接变体 |
| 图标 | `lucide-react` | 第二套图标库、emoji 当功能图标 |
| 全局提示 | `sonner`（`ui/sonner.tsx`） | 自建 toast/Notification |
| 命令面板 | `cmdk`（`ui/command-palette.tsx`） | 自写 ⌘K 面板 |
| 表单/校验 | `react-hook-form` + `@hookform/resolvers` + `zod` | 手写表单校验状态机 |
| 数据表格 | `@tanstack/react-table`（`ui/data-table.tsx`） | 手写排序/分页表格 |
| 长列表虚拟化 | `@tanstack/react-virtual` | 手写虚拟滚动 |
| 常规图表 | `recharts`（`ui/chart.tsx`，吃 viz token） | 重复引入第二套图表库 |
| 迷你趋势/环图 | `ui/sparkline.tsx`、`ui/donut-chart.tsx` | 同类再造 |
| 节点/编排拓扑 | `@xyflow/react` | 自绘节点图 |
| 3D | `three` | — |
| 富文本 | `@tiptap/*` | 手写 contenteditable 编辑器 |
| 轮播 | `embla-carousel-react`（`ui/carousel.tsx`） | 手写轮播 |
| 分栏拖拽 | `react-resizable-panels`（`ui/resizable.tsx`） | 手写拖拽分栏 |
| 新手引导 | `driver.js` | 手写遮罩引导 |
| 数字动画 | `@number-flow/react` | rAF count-up |
| 时序动画 | `gsap`（+`@gsap/react`） | 见 §4 |
| 服务端状态 | `swr`（`useFetch` / `hooks/use-*.ts`，见 §6.2） | 自建 fetch 缓存/重试、useEffect 取数三态机 |
| 客户端全局状态 | `zustand`（`stores/`，见 §6.4） | 用 Context 堆全局 store、引入第二套状态库 |
| URL 查询状态 | `nuqs`（见 §6.3） | 手写 router query 同步 |
| 主题 | `next-themes` | 手写主题切换 |
| 日期 | `date-fns` | 手写日期格式化 |
| 动画化 CSS 类 | `tw-animate-css` | 重复定义同名 keyframes |

---

## 6. 状态管理分层（五层，不允许越层）

核心原则：**状态放在离它「该被谁消费、活多久」最近的一层；服务端数据不进客户端 store，同一事实只保留一个权威来源。**

### 6.1 五层分工与裁决顺序

| 层 | 工具 | 装什么 | 不装什么 |
|---|---|---|---|
| 服务端状态 | **SWR**（`useFetch` / `hooks/use-*.ts`） | 一切来自 `/api` 的列表/详情及其缓存、去重、重验、错误重试 | 响应副本搬进 zustand/useState 当第二数据源 |
| URL 状态 | **nuqs** | 搜索词、筛选、排序、分页、当前 tab、选中 id、需要链接可分享/前进后退/刷新保留的面板开关 | hover、临时菜单展开、拖拽中等纯瞬态 |
| 全局客户端状态 | **zustand**（`stores/`） | 跨页面或远亲组件共享的 UI/运行时：SSE 事件总线、Agent 在场态、跨页流程态、全局 UI 开关 | 服务端数据副本、可由 props/SWR/URL 派生的值 |
| 作用域/依赖注入 | **React Context**（`components/providers/`） | 主题、SWR 全局配置、服务发现门面这类「提供一次、全树消费」的服务 | 高频变化的数据、全局可变状态 |
| 局部状态 | **useState / useReducer** | 只被组件自身或紧邻父子树消费的状态 | 已满足上层条件却滞留本地、导致 props 钻取两层以上的状态 |

裁决提问顺序：**来自接口吗 → SWR；需要进链接/刷新保留吗 → nuqs；跨路由或远亲组件共享吗 → zustand；一次性注入的服务/配置吗 → Context；都不是 → 局部 state。**

### 6.2 服务端状态：SWR（客户端唯一取数通道）

- GET 数据统一走 `hooks/use-fetch.ts` 的 `useFetch<T>(url)`：自动解包 `{ success, data, error }`，返回 `{ data, loading, error, refetch }`；业务 hook（`hooks/use-*.ts`）在其上封装，组件不裸写 SWR 配置。
- 全局策略以 `components/providers/swr-provider.tsx` 为唯一真源：`revalidateOnFocus: false`（防止切标签页触发付费 API）、断网重连静默重验、60s 去重、错误重试 2 次；业务侧不得私自打开 focus 重验。
- 写操作走 `apiPost/apiPatch/apiPut/apiDelete`；成功后用 `mutate(key)` / `useGlobalMutate()` 失效相关 GET 缓存重取。需要乐观更新时先 `mutate(optimistic, { revalidate: false })`、settle 后再重验，不许另维护一份手写副本。
- RSC 首屏数据走 island props（见 `AGENTS.md` 双路径），SWR 只负责导航后与交互后的客户端刷新，两者不抢职责。
- **禁止 `useEffect + fetch + useState` 手写 loading/error/缓存三态机。**

### 6.3 URL 状态：nuqs

- 查询条件型状态（筛选/排序/分页/搜索/tab/选中 id）一律 nuqs：链接可分享、前进后退可回退、刷新不丢；它同时作为 SWR key 的一部分，条件变化即自动重取。
- 必须用带类型的 parser 与显式默认值（`parseAsString` / `parseAsInteger` / `parseAsArrayOf` …）；高频改写（输入、翻页）用 `history: "replace"`，切换视图语义才用 `"push"`。
- App Router 需在根 layout 挂载一次 `<NuqsAdapter>`（当前尚未挂载，首次使用时在 `components/providers/` 新增并接入 `app/layout.tsx`）。
- 瞬态 UI（hover、弹层展开、拖拽进行值）不进 URL。

### 6.4 全局客户端状态：zustand

以 `stores/agent-presence.ts`（内存型 / SSE 总线）和 `stores/journey-run.ts`（persist 跨页流程态）为范本：

1. **位置**：全局 store 统一放 `stores/<domain>.ts`，导出 `useXxx`；非 React 的模块级 registry 放 `lib/**`（参照 `lib/mcp/service-registry.ts`）。`hooks/use-sidebar.ts` 是历史位置，新增 store 不放 `hooks/`。
2. **形态**：state 与 actions 同店；action 用动词（set / start / advance / reset / push / mark）；文件顶部注释写清「谁写、谁读、生命周期」。
3. **订阅粒度（zustand v5）**：逐字段 selector——`useXxx((s) => s.foo)`；禁止整店解构 `const { a, b } = useXxx()` 造成无关重渲染，多字段用多个 selector 或 `useShallow`；selector 不得每次返回新对象/新数组（会触发无限渲染，`DiscoveryProvider` 已踩过此坑）。
4. **组件外读写**：kernel 插件、SSE/事件回调、非 React 模块一律 `useXxx.getState()` 取值、`getState().action()` 派发；非组件里禁止调用 hook。
5. **连接型副作用**：EventSource/WebSocket 由 store action 创建并返回 cleanup（参照 `connect()`），组件在 `useEffect` 里挂载/卸载；连接句柄不进 state。
6. **持久化**：仅「跨刷新必须续上的流程态」用 `persist`，key 见名知意（如 `"journey-run"`），并用 `partialize` 只存必要字段；瞬态队列、开关、句柄不持久化；**凭据/key/token 绝不进 store 与 localStorage**（与 `AGENTS.md`「凭据不落库」一致）。
7. **有界与派生**：只增不减的列表必须设上限（参照 telemetry `slice(0, 8)`）；能现算的派生值不入库，消费时用 selector 现算。
8. 不引入 Redux / Jotai / Recoil / MobX / Valtio 等第二套全局状态库。

### 6.5 Context 与局部状态

- Context 只做依赖注入/作用域门面（ThemeProvider、SwrProvider、DiscoveryProvider）：`value` 必须 `useMemo`，消费 hook 取不到值时抛错（参照 `useDiscovery`），文件放 `components/providers/`。
- 复合组件内部 Context（如 `carousel`、`chart`）允许与组件同文件，属组件实现细节，不外泄。
- 高频变化（动画帧、流式输出、每秒多次更新）走 zustand 细粒度 selector 或 `useRef`，不许经 Context value 广播全树。
- 局部状态就近 `useState/useReducer`；表单交给 react-hook-form + zod，不用 useState 逐字段托管；props 钻取超过两层时，先判断该状态是否应升格为 nuqs/zustand，而不是先加 Context。

### 6.6 写操作闭环范式

`nuqs 查询条件 → 拼成 SWR key → useFetch 取数渲染 → apiPost/Patch 写操作 → mutate 失效缓存 → SWR 重取 → UI 更新`；跨页面流程信号（运行态、全局开关、事件总线）走 zustand；**服务端数据绝不经过 zustand 中转。**

---

## 7. 页面与加载范式

- 每个页面遵循 `AGENTS.md` 的 `page.tsx / islands / *-client.tsx / loading.tsx / error.tsx` 结构；`loading.tsx` 用 `.skeleton` 画出与真实布局同尺寸的骨架，不许只放一个转圈。
- 页面内容容器统一 `.page-container`；页头用 `components/ui/page-header.tsx` 或 `.dash-pagehead` 族（面包屑 `.dash-crumbs` 用等宽 12px、H1 26px -0.02em、描述 13.5px muted）。
- 仪表盘类布局复用既有 class 族，不另起炉灶：`.dash-kpi-grid`/`.dash-kpi`（KPI）、`.dash-panel`（面板）、`.dash-grid-main`（3:2）、`.dash-wf-row`（工作流行）、`.dash-alert-row`（告警行）、`.data-grid`（发丝线分割网格）、`.dash-stream`（等宽流式日志）。
- 状态点用 `.dash-dot`（ok/warn/danger/idle），运行态脉冲用内建 `dash-pulse`，不要另造呼吸灯。
- 响应式：主断点 1180px（KPI 4→2 列、3:2→1 列，照既有 media 写法扩展）；更小屏下侧栏转 Sheet、表格横向滚动而非挤压。
- 反馈闭环：异步操作按钮必有 loading/disabled 态；结果用 `sonner`；危险操作需二次确认（用 `bunx shadcn@latest add alert-dialog` 引入，基于 Radix，勿用 `window.confirm`）；空状态给一句说明 + 主动作按钮。

---

## 8. 可访问性（A11y）

- `prefers-reduced-motion: reduce`：所有 JS 动画降级为显隐切换（§4.3），CSS 无限动画也应在该媒体查询下暂停。
- 键盘：Radix 原语保证 Esc/方向键/Tab 顺序；自定义可交互元素必须可达、可操作、焦点环可见。
- 对比度：正文对背景 ≥ 4.5:1；muted-foreground 不用于关键信息；语义色不只靠颜色区分（配图标/文案）。
- 表单：`Label` 关联控件（`@radix-ui/react-label`），错误信息 `aria-invalid` + `aria-describedby`。
- E2E（Playwright）优先 role/text 选择器，动画钩子 `data-animate` 可作辅助，不依赖生成的 class。

---

## 9. 提交前自检清单（逐条过）

**Token 与样式**
- [ ] 没有硬编码 hex/oklch/rgb 颜色（`globals.css` 定义 token 除外；现存 `agent-palette.tsx` 顶部颜色常量属待还技术债，新代码不得效仿）
- [ ] 没有 token 可表达却写 `text-[13px]`/`w-[213px]` 任意值；没有自写 box-shadow / 第二套圆角尺度
- [ ] 新颜色同时补了 light 与 dark；`.dark` 下实际看过
- [ ] 页面套了 `.page-container`，间距对齐 4px 栅格

**组件**
- [ ] 先用了 `components/ui` 与 §5 能力地图，没有重造轮子
- [ ] 新原子件在 `components/ui`、无业务、forwardRef + cva + cn + asChild、焦点环齐全
- [ ] 图标只用 lucide；没有引入第二个同能力库；包管理用 bun

**状态管理（§6）**
- [ ] 接口数据走 SWR/`useFetch`，没有 useEffect 手写取数、没有把响应副本存进 zustand
- [ ] 写操作后 `mutate` 失效了相关缓存；查询条件走 nuqs 且带类型 parser/默认值
- [ ] 新全局 store 在 `stores/`、细粒度 selector、组件外用 `getState()`、无整店解构
- [ ] persist 只存必要字段，无凭据/瞬态入 localStorage；Context value 已 useMemo

**动效**
- [ ] 新增动画默认走 GSAP，参数落在 §4.3 标准区间，ease 不用弹性
- [ ] 有 `data-animate` 钩子、`autoAlpha`、`clearProps`、scope cleanup、reduced-motion 降级
- [ ] 只动 transform/opacity；动画不阻塞交互、首屏 1s 内入场完毕

**可达与反馈**
- [ ] loading / empty / error 三态齐备；异步有反馈与禁用态
- [ ] 键盘可达、对比度达标、数字 tabular-nums

**验证**- [ ] `bun run lint` 通过；`bun run build` 通过；改动页面跑对应 `e2e/*.spec.ts`（无单测，E2E 是唯一自动化门禁）。

---

## 10. 反模式（明令禁止）

1. 在组件里硬编码颜色、自造阴影/圆角/字号尺度，绕开 token；
2. 手写 Dialog/Dropdown/Tooltip/Select/Toast/命令面板/虚拟列表/表格排序；
3. 引入第二个图标库、第二套 toast、第二套图表/请求/状态管理库；
4. 新增动画默认上 framer-motion 或一把梭 CSS keyframes 做时序编排；
5. 动画 `top/left/width/margin`、用 back/elastic 缓动、动画里 setState 轮询、卸载不 cleanup；
6. `components/ui/` 里写业务、发请求、import `lib/server/**`；
7. 大面积渐变、毛玻璃、霓虹 glow 当装饰（glow 只服务运行态语义）；
8. 只验 light 不验 dark、只验有数据不验空/加载/报错态；
9. 用 npm/pnpm/yarn 装包；用手改的方式覆盖 shadcn/registry 组件却不留注释说明偏离原因。
10. 把接口响应拷进 zustand/useState 当第二数据源，或写操作后不 `mutate` 失效缓存；
11. `useEffect + fetch + useState` 手写取数三态机、私自打开 SWR focus 重验；
12. zustand 整店解构订阅、selector 返回新对象/新数组、在非组件里调用 store hook；
13. 筛选/分页/tab 等查询条件用本地 state 导致链接不可分享、刷新丢失；用 Context 广播高频变化状态；
14. 引入第二套全局状态库（Redux/Jotai/Recoil/MobX/Valtio）。

---

## 11. 文档维护

- Token、class 族、能力地图发生增减时，同步更新本文与 `AGENTS.md` 相关小节，避免两份事实漂移。
- 规范冲突仲裁：架构/分层/部署听 `AGENTS.md` 与 `docs/architecture/`；视觉、动效、组件手感听本文；两者都未覆盖的，以 Linear / Vercel / Neon 同级完成度为准并在评审中沉淀回本文。
