# FlowMind 前端重设计计划 V2 — 深度实施版

> 基于 V1 计划 + 用户7大痛点详细规格 + 前端设计最佳实践的全面升级方案

---

## 〇、设计方向确认

**视觉语言**: Industrial Data-Science（Linear 克制 × Bloomberg 密度 × Vercel 清晰）

**色彩体系**:
- 主色: `#f59e0b` (琥珀 Amber) — 跨境电商的商业本质
- 辅助: `#6366f1` (靛蓝 Indigo) — Agent / 系统层
- 成功: `#10b981` (翡翠 Emerald) — 在线 / 正常
- 危险: `#ef4444` (红 Red) — 风险 / 熔断
- 警告: `#f97316` (橙 Orange) — 预警状态
- 背景: `#09090b` (真黑) — 极深底色
- 面板: `#111827` (深灰蓝) — 卡片/面板背景
- 边框: `#1e293b` — 分割线
- 文字层级: 主文字 `#e2e8f0` → 次文字 `#94a3b8` → 弱文字 `#64748b`

**核心原则**:
1. 每个痛点 = 一个「插件工作流」模块，不是一张卡片
2. 拒绝 Card 马赛克，用 section-based 布局 + 面板 + 数据表格
3. 信息密度高但层次分明：标题 → 指标 → 操作 → 详情，四层递进
4. 动效服务于数据感知：状态流转、数据刷新、工作流执行都有视觉反馈
5. 每个工作流页面有独立的布局范式，避免模板化

**Next.js 16 关键约束**:
- 异步请求 API: `params` 和 `searchParams` 必须 `await`
- `middleware.ts` → `proxy.ts`（如需要）
- Turbopack 默认启用
- `PageProps<'/path'>` 类型辅助
- 所有页面默认 Server Component，需要交互时加 `"use client"`

---

## 一、依赖安装

```bash
pnpm add framer-motion next-themes @tanstack/react-table
```

| 依赖 | 用途 |
|------|------|
| `framer-motion` | 页面过渡动画、工作流节点动效、数据流动画、stagger 列表 |
| `next-themes` | 规范的暗色/亮色模式管理（替换手动 DOM 操作） |
| `@tanstack/react-table` | 数据透视表（广告数据分析、库存表格、关键词表格） |

---

## 二、路由架构（最终版）

```
概览
  └── 仪表盘                    /dashboard                      [重写]

插件工作流（核心功能区 — 侧边栏最大视觉权重）
  ├── 🔍 选品工作流             /workflows/product-research      [新建] ⭐最复杂
  ├── 🎨 AI 作图               /workflows/ai-imaging            [新建]
  ├── 📊 AI 广告               /workflows/ai-advertising        [新建]
  ├── 📦 AI 上架               /workflows/ai-listing            [新建]
  ├── 📋 库销比                /workflows/inventory             [新建]
  └── 🎯 竞品广告分析          /workflows/competitor-ads        [新建]

监控中心
  ├── 账号风险                  /risk                            [重写]
  ├── Agent 管理               /agents                          [优化]
  ├── 任务中心                  /tasks                           [优化]
  └── 风险熔断                  /circuit-breaker                 [新建，从risk拆出]

系统
  ├── 记忆系统                  /memory                          [优化]
  ├── 自进化                    /evolution                       [优化]
  └── 设置                      /settings                        [保留]
```

**删除**: `app/business/` 整个目录（4个文件）

---

## 三、Phase 1 — 基础设施升级（7步）

### Step 1: 安装新依赖

```bash
pnpm add framer-motion next-themes @tanstack/react-table
```

### Step 2: 集成 next-themes

**修改 `app/layout.tsx`**:
- 移除手动 `<script>` 标签和 `dark` class 手动控制
- 创建 `components/providers/theme-provider.tsx`（客户端组件）
- 使用 `<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>` 包裹应用
- 保留 `suppressHydrationWarning` 在 `<html>` 上

### Step 3: 重构 globals.css

全新色彩系统 + 动画基础设施:
- 亮色/暗色主题的完整 CSS 变量定义
- 语义化色板: `--workflow-product`(选品蓝), `--workflow-imaging`(作图紫), `--workflow-ad`(广告橙), `--workflow-listing`(上架绿), `--workflow-inventory`(库存青), `--workflow-competitor`(竞品粉)
- 新增动画 keyframes: `fade-in-up`, `slide-in-right`, `pulse-glow`, `number-scroll`, `flow-line`
- 数据密度优化: 表格行高、紧凑间距变量
- 新增 utility class: `.glass-panel`, `.data-grid`, `.workflow-card`, `.metric-value`, `.status-glow`

### Step 4: AnimatedNumber 组件

**文件**: `components/ui/animated-number.tsx`

功能:
- 数字滚动动画（从旧值过渡到新值）
- 支持前缀/后缀（如 `$`, `%`, `天`）
- 支持千分位分隔
- 使用 framer-motion `useSpring` + `useTransform`

### Step 5: DataTable 组件

**文件**: `components/ui/data-table.tsx`

功能:
- 基于 `@tanstack/react-table` 封装
- 固定表头
- 列排序、筛选、列可见性控制
- 行选择（checkbox）
- 行内状态指示器（状态灯 dot）
- 分页控制
- 导出 CSV 按钮
- 空状态展示
- 加载骨架屏

### Step 6: WorkflowStepper 组件

**文件**: `components/ui/workflow-stepper.tsx`

功能:
- 纵向步骤导航器
- 每步显示: 步骤编号/图标 + 步骤名 + 状态(待执行/进行中/已完成/错误)
- 进行中步骤有脉冲动画高亮
- 步骤之间的连接线（虚线/实线/进度线）
- 支持点击跳转已完成步骤
- 紧凑模式（侧边栏使用）和展开模式（页面使用）

### Step 7: PageTransition 组件

**文件**: `components/ui/page-transition.tsx`

功能:
- 使用 framer-motion `<AnimatePresence>` + `<motion.div>`
- 进入动画: `opacity: 0 → 1, y: 8 → 0`（淡入 + 微上移）
- 退出动画: `opacity: 1 → 0, y: 0 → -4`
- 持续时间: 200ms enter, 150ms exit
- 缓动: `ease-out`

---

## 四、Phase 2 — 布局重构（3步）

### Step 8: 重构 Sidebar

**文件**: `components/layout/sidebar.tsx`

**导航结构**（三大分组 + 工作流强化区）:

```
┌─ 概览 ─────────────────┐
│  ● 仪表盘               │
├─ 插件工作流 ▾ ──────────┤  ← 视觉权重最大，带状态灯
│  ◉ 选品工作流  [运行中]  │     绿色=运行中, 灰色=空闲, 黄色=有告警
│  ◉ AI 作图    [空闲]    │
│  ◉ AI 广告    [运行中]  │
│  ◉ AI 上架    [空闲]    │
│  ◉ 库销比     [告警]    │
│  ◉ 竞品广告   [空闲]    │
├─ 监控中心 ─────────────┤
│  账号风险               │
│  Agent 管理             │
│  任务中心               │
│  风险熔断               │
├─ 系统 ─────────────────┤
│  记忆系统               │
│  自进化                 │
│  设置                   │
└─────────────────────────┘
```

**设计细节**:
- Logo 区: 使用 SVG 替代 emoji，FlowMind 标志带琥珀色光晕
- "插件工作流" 分组增加左侧竖线装饰（琥珀色）
- 每个工作流项左侧显示小型状态灯（3色: 绿/灰/黄/红）
- 工作流项 hover 时显示"最近执行"微型摘要
- 折叠模式: 工作流区域只显示图标+状态灯
- 底部: 折叠按钮 + 系统版本号
- 新增: 搜索/快速命令入口（Cmd+K 提示）

### Step 9: 重构 TopBar

**文件**: `components/layout/topbar.tsx`

**新增组件**:
- `components/ui/command-palette.tsx` — Cmd+K 命令面板
  - 使用 `<Dialog>` + `<Input>` + 键盘导航
  - 搜索范围: 页面、Agent、任务、工作流、设置
  - 最近访问区
  - 快捷操作区（新建任务、启动工作流等）
- `components/ui/notification-panel.tsx` — 通知面板
  - 点击 Bell 图标展开的滑入式面板（右侧抽屉）
  - 按风险等级分组: 紧急/警告/信息
  - 每条通知: 图标 + 标题 + 时间 + "查看"链接
  - 未读数 Badge
  - "全部已读"按钮

**TopBar 重构内容**:
- 搜索框 → 点击触发 CommandPalette（显示 `⌘K` 快捷键提示）
- 通知按钮 → 点击展开 NotificationPanel
- 主题切换 → 使用 `next-themes` 的 `useTheme()` 替换手动 DOM 操作
- 新增: 当前活跃工作流数 + Agent 在线数的微型指标
- 保留: 用户菜单 DropdownMenu

### Step 10: 重构 Dashboard

**文件**: `app/dashboard/page.tsx` + 子组件

**布局**: 系统脉搏式（非卡片马赛克）

```
┌─────────────────────────────────────────────────┐
│ 系统脉搏横幅（单行，左侧大字指标，右侧迷你图表）   │
│ 7个工作流 | 6 Agent在线 | 12任务运行中 | 2告警    │
├────────────────────────────┬────────────────────┤
│ 工作流执行状态面板          │ Agent 心跳时间线    │
│ （7行，每行: 工作流名+状态   │ （横向时间轴，彩色  │
│  + 最近执行时间 + 快捷操作） │  脉冲点表示心跳）   │
├────────────────────────────┴────────────────────┤
│ 最近告警（简洁列表行，非 Card 堆叠）              │
│ [风险] 库销比预警: SKU-A001 库存可售78天          │
│ [信息] AI广告: 3个高ACOS词已标记                  │
│ [警告] 账号风险: 绩效通知待处理                   │
├─────────────────────────────────────────────────┤
│ 关键业务指标趋势图（折线图: 近7天销售额/ACOS/转化率）│
└─────────────────────────────────────────────────┘
```

**删除旧组件**:
- `components/dashboard/stats-overview.tsx`
- `components/dashboard/agent-status-card.tsx`
- `components/dashboard/task-overview-chart.tsx`
- `components/dashboard/system-metrics.tsx`
- `components/dashboard/risk-alerts.tsx`

**新建组件**:
- `components/dashboard/system-pulse.tsx` — 系统脉搏横幅
- `components/dashboard/workflow-status-panel.tsx` — 工作流状态面板
- `components/dashboard/agent-heartbeat.tsx` — Agent 心跳时间线
- `components/dashboard/recent-alerts.tsx` — 最近告警列表
- `components/dashboard/business-trends.tsx` — 业务趋势图

---

## 五、Phase 3 — 核心工作流页面（6个，详细设计）

---

### Step 11: 选品工作流 `/workflows/product-research` ⭐ 最复杂

**文件结构**:
```
app/workflows/product-research/
  page.tsx                              — 主页面（三栏布局）
  components/
    research-stepper.tsx                — 步骤导航器（左侧）
    step1-data-collection.tsx           — 数据采集配置
    step2-keyword-analysis.tsx          — 热词趋势分析
    step3-review-analysis.tsx           — 差评反推痛点
    step4-ai-differentiation.tsx        — AI 差异化建议
    step5-product-proposal.tsx          — 产品方案生成
    data-source-card.tsx                — 数据源配置卡片
    keyword-table.tsx                   — 关键词数据表格
    pain-point-cloud.tsx               — 痛点词云/聚类可视化
    ai-insight-card.tsx                — AI 分析洞察卡片
    patent-risk-badge.tsx              — 专利风险标识
    mock-data-research.tsx             — 选品工作流专用 mock 数据
```

**布局**: 三栏式工作台
```
┌──────────┬────────────────────────────┬────────────┐
│ 左栏      │ 中栏                       │ 右栏        │
│ (240px)   │ (flex-1)                   │ (320px)     │
│           │                            │             │
│ 步骤导航   │ 当前步骤主操作区             │ 实时数据面板 │
│           │                            │ AI分析预览   │
│ 1.数据采集  │                            │             │
│ 2.热词分析  │                            │             │
│ 3.差评反推  │                            │             │
│ 4.AI建议   │                            │             │
│ 5.方案生成  │                            │             │
└──────────┴────────────────────────────┴────────────┘
```

#### 步骤1 — 数据采集配置

**中栏**: 数据源配置面板

9 个数据源卡片（2列网格），每个卡片包含:
- 平台图标 + 名称 + 开关(Select)
- 平台特有的配置条件（展开/折叠）

**各平台具体配置**:

| 平台 | 配置项 |
|------|--------|
| Amazon 前台 | 潜力爆款条件: BSR范围(滑块)、上架时间≤6个月、小类前100新品占比(%)、大类排名范围 |
| TikTok | 热门标签输入、播放量阈值(万)、视频发布时间范围 |
| YouTube | 搜索关键词、视频热度阈值(播放量/点赞比)、发布时间范围 |
| 1688 | 产品关键词、产地筛选(多选: 广东/浙江/福建等)、工厂评级(A级以上)、经营模式 |
| SIF | ASIN输入、分析维度(新品期/老品期广告占比、广告结构) |
| 卖家精灵 | ASIN输入、验证维度(多选): 关键词热度趋势、精准搜索量、CPC竞价、竞争激烈度、供需比、集中度、退货率、广告占比 |
| Fastmoss | 产品关键词、TikTok分析维度 |
| Google Trends | 关键词输入(多词对比)、地区(多选)、时间范围 |
| 专利检索 | 关键词、专利类型(多选): 外观专利/发明专利/商标trade mark |

**底部操作栏**:
- 「开始采集」按钮（琥珀色主按钮）
- 点击后: 每个已启用的平台显示一行进度条（平台名 + 进度% + 状态文字）
- 采集完成后自动跳转步骤2

**右栏**: 采集状态总览
- 已配置平台数 / 已完成平台数
- 预计数据量
- 实时日志流（滚动文本区）

#### 步骤2 — 热词趋势分析

**中栏**: 关键词数据表格 + 筛选工具栏

表格列: `关键词 | 搜索量 | CPC竞价 | 竞争激烈度 | 供需比 | 集中度 | 趋势(sparkline) | Google Trends走势 | AI标注`

筛选工具栏:
- 快速筛选按钮组: 高增长 | 低竞争 | 高供需比 | 潜力爆款
- 搜索框: 实时过滤关键词
- 排序: 按搜索量/CPC/竞争度/供需比

AI 标注列:
- 🟢 "潜力爆款词" — 高增长 + 低竞争 + 高供需比
- 🟡 "竞争激烈" — 低供需比 + 高集中度
- 🔴 "风险词" — 垄断比例高

**右栏**: 趋势总览
- Top 10 热词的搜索量柱状图
- 关键词分类统计（核心词/长尾词/竞品词数量）

#### 步骤3 — 差评反推痛点

**中栏**: 差评分析面板

输入区: ASIN 输入框 + 「开始分析」按钮

分析结果区:
- 竞品信息卡片: 产品名 + 图片 + 评分 + 评论数
- 痛点聚类面板（4列网格）:
  - 📦 材质问题 — 提及次数 + 占比条
  - 🎨 设计缺陷 — 提及次数 + 占比条
  - ⚙️ 功能不足 — 提及次数 + 占比条
  - 🔧 耐用性差 — 提及次数 + 占比条
- 差评关键词标签云（按频率大小排列）
- AI 建议面板: "基于差评分析，建议改进方向: ..."（Notion 风格宽幅内容块）

**右栏**: 差评数据统计
- 评分分布饼图（1-5星）
- 差评时间趋势（近6个月）
- 高频差评词 Top 10 列表

#### 步骤4 — AI 差异化建议

**中栏**: 多模块分析结果（Notion 风格宽幅内容块，非通用 Card）

模块排列（垂直堆叠，每个模块可折叠）:

**模块1: 市场垄断分析**
- 头部卖家占比饼图（头部≤35%为绿色安全区，>35%为红色警告）
- 头部品牌列表（品牌名 + 链接数 + 占比 + 专业度评级）
- 品牌词搜索结果评估（"专业卖家" / "中小卖家" 标签）
- 结论: "该市场竞争度 [低/中/高]，中小卖家进入难度 [易/中/难]"

**模块2: 外部流量依赖度评估**
- TikTok 流量占比指标（大字: 如 42%）
- 如果 > 30% → 🔴 警告提示: "该产品依赖外部TikTok流量，单一亚马逊平台推广风险高，建议评估TikTok推广能力后再决定"
- 流量来源渠道分布柱状图

**模块3: 专利风险检测**（重要！标红强调）
- 三类专利状态卡片:
  - 外观专利: ✅ 无风险 / ⚠️ 有相似专利 / 🔴 已侵权
  - 发明专利: ✅ 无风险 / ⚠️ 有相关专利 / 🔴 已侵权
  - 商标trade mark: ✅ 无风险 / ⚠️ 有近似商标 / 🔴 已注册
- 专利详情列表（专利号 + 持有人 + 有效期 + 风险等级）
- 绕开建议: AI 给出如何设计差异化以规避专利

**模块4: 产品差异化方向**
- 结构建议（含分析逻辑说明）
- 外观建议（含参考图 placeholder）
- 产品组合建议
- 卖点设计列表（每个卖点: 标题 + 竞品对比 + 优势说明）

**模块5: 供应链建议**
- 1688 优质工厂推荐（按产地分组: 广东/浙江/福建）
- 每个工厂: 名称 + 评级 + 主营产品 + 最小起订量 + 价格区间

**右栏**: AI 综合评分
- 市场机会评分: 85/100（大字）
- 维度细分: 市场需求 / 竞争度 / 利润空间 / 供应链成熟度（各进度条）
- 综合建议: "推荐进入，建议差异化方向: ..."

#### 步骤5 — 产品方案生成

**中栏**: 自动生成的完整方案文档

方案内容（按章节排列，Markdown 渲染风格）:

1. **产品定义**
   - 产品名称建议
   - 目标市场定位
   - 价格区间建议

2. **产品结构 & 外观建议**
   - 结构改进方案（含分析逻辑）
   - 外观设计方案 — 3种风格:
     - 风格A: 极简现代
     - 风格B: 自然有机
     - 风格C: 科技未来
   - 每种风格有 placeholder 图片区（标注"ComfyUI/SD 生成"）

3. **卖点设计**
   - 5个核心卖点（每个: 卖点标题 + 一句话描述 + 对比竞品优势）

4. **包装方案**
   - 包装风格建议
   - 材质建议
   - 成本估算

5. **目标工厂列表**
   - 推荐工厂卡片组

**操作栏**:
- 「导出 PDF」按钮
- 「发送到飞书」按钮
- 「发送到 AI 作图工作流」按钮（自动跳转到作图工作流并带入产品参数）

**右栏**: 方案概要
- 方案完成度 checklist（5项，每项打勾）
- 一键操作快捷入口

---

### Step 12: AI 作图 `/workflows/ai-imaging`

**文件结构**:
```
app/workflows/ai-imaging/
  page.tsx                              — 主页面
  components/
    image-type-tabs.tsx                 — 主图/场景图/A+/视频分镜 Tab
    product-input-panel.tsx             — 产品信息输入区
    image-gallery.tsx                   — 图片网格（瀑布流/网格切换）
    image-card.tsx                      — 单张图片卡片（含评分）
    score-bar.tsx                       — CLIP+CTR 评分条
    template-selector.tsx               — 预设模板选择器
    video-storyboard.tsx                — 视频分镜板（时间轴卡片）
    mock-data-imaging.tsx              — AI 作图专用 mock 数据
```

**布局**: 画廊式工作台
```
┌─────────────────────────────────────────────────┐
│ 产品信息输入区（关键词/ASIN/产品图上传）           │
├─────────────────────────────────────────────────┤
│ [主图] [场景图] [A+页面] [视频分镜]    [生成] [网格]│
├─────────┬─────────┬─────────┬─────────┬─────────┤
│  图片1   │  图片2   │  图片3   │  图片4   │  图片5   │
│ CLIP: 87 │ CLIP: 82 │ CLIP: 79 │ CLIP: 91 │ CLIP: 76│
│ CTR: 72  │ CTR: 85  │ CTR: 68  │ CTR: 88  │ CTR: 63 │
│ [✓ 最佳] │          │          │ [✓ 最佳] │         │
├─────────┴─────────┴─────────┴─────────┴─────────┤
│ 操作栏: [批量下载] [发送到上架] [重新生成低分图]      │
└─────────────────────────────────────────────────┘
```

**核心功能详解**:

1. **产品信息输入区**:
   - 关键词输入
   - ASIN 输入（自动拉取产品信息）
   - 产品图上传（拖拽区）
   - ComfyUI 工作流选择（预设模板下拉）

2. **图片类型 Tab**:
   - **主图**: 符合 Amazon 规范（白底、纯产品、1000x1000+），预设模板
   - **场景图**: 多风格场景（家居/户外/办公），增强容错率，预设完美图片模板
   - **A+页面**: 模块化布局（图文组合），预设 A+ 模板
   - **视频分镜**: 分镜板式时间轴（5-8个镜头卡片，每卡: 画面描述 + 参考图 + 时长 + 文案）

3. **图片卡片 `image-card.tsx`**:
   - 图片预览（固定比例，可放大）
   - CLIP 评分: 绿色(>80) / 黄色(60-80) / 红色(<60) — 评分条
   - CTR 预测分数: 同上颜色系统
   - 综合评分 = CLIP×0.6 + CTR×0.4
   - 「标记最佳」勾选框
   - 「下载」「发送到上架」操作按钮
   - 生成参数展示（展开查看: prompt、模型、seed）

4. **视频分镜板 `video-storyboard.tsx`**:
   - 横向时间轴，每张分镜卡片:
     - 画面描述（文字）
     - 参考图（AI 生成的预览）
     - 时长标注（如 3s / 5s）
     - 文案/旁白文字
     - 运镜标注（推/拉/摇/移）
   - 参考来源: "参考亚马逊爆款视频" / "参考 TikTok 爆款视频"
   - 创意建议面板: AI 基于竞品视频分析给出的创意方向

---

### Step 13: AI 广告 `/workflows/ai-advertising`

**文件结构**:
```
app/workflows/ai-advertising/
  page.tsx                              — 主页面（双面板布局）
  components/
    strategy-config.tsx                 — 左面板: 策略配置
    data-pivot-table.tsx                — 右面板: 数据透视表
    keyword-tag-system.tsx              — AI 标记系统（三色标签）
    bidding-rules-panel.tsx             — 竞价规则配置面板
    google-trends-mini.tsx              — Google Trends 迷你折线图
    auto-adjust-panel.tsx               — 自动调整策略面板（灰度）
    mock-data-advertising.tsx           — 广告专用 mock 数据
```

**布局**: 双面板工作台
```
┌────────────────────┬────────────────────────────┐
│ 左面板(360px)       │ 右面板(flex-1)              │
│                    │                            │
│ 产品类型选择         │ 数据透视表                   │
│ [精品] [精铺]        │ (关键词 × 展示/点击/花费/     │
│                    │  销售/ACOS/转化率/CPC)        │
│ 精品模式配置:        │                            │
│ - 关键词来源(多选)   │ ──────────────────────────  │
│ - 广告类型(SP/SB/SD) │ AI 标记系统                  │
│ - 竞价规则          │ 🔴 高ACOS词 (3个)            │
│ - 分析周期          │ 🟢 高转化词 (5个)            │
│                    │ ⚪ 非精准词 (2个)             │
│ 精铺模式配置:        │                            │
│ - 竞品ASIN输入      │ ──────────────────────────  │
│ - 关键词数量(默认20) │ Google Trends 热度变化        │
│                    │ (内嵌迷你折线图)              │
│ ─────────────────  │                            │
│ [开始分析] 按钮      │ ──────────────────────────  │
│                    │ 自动调整策略(灰度)            │
│                    │ [降价] [加预算] [否词]         │
└────────────────────┴────────────────────────────┘
```

**核心功能详解**:

1. **策略配置区**:
   - 产品类型切换: 精品 / 精铺（Tab 切换）
   - **精品模式**:
     - 关键词来源: 卖家精灵 / SIF / Amazon 前台（多选 Checkbox）
     - 筛选逻辑说明: "只保留精准词根词，自动拓展长尾词"
     - 广告类型: SP / SB / SD（多选标签）
     - 广告组规则: "每词一个广告组"（自动执行标识）
     - **竞价规则面板 `bidding-rules-panel.tsx`**:
       - 规则展示: "后台建议价 - $0.2"
       - 封顶规则: "超过 $1 则固定 $0.5"
       - 可视化: 价格区间图（建议价 vs 实际出价）
     - 分析周期:
       - 新品（上架≤30天）: 14天分析周期
       - 老品: 每周一，7天分析
       - 广告类型: SP + SB 数据
   - **精铺模式**:
     - 竞品 ASIN 输入（多行）
     - 自动收集类目前20同类型产品关键词
     - 取流量前20关键词
     - 人为开启广告

2. **数据透视表 `data-pivot-table.tsx`**:
   - 基于 `@tanstack/react-table`
   - 行: 关键词（支持展开查看详情）
   - 列: 展示 | 点击 | 花费 | 销售 | ACOS | 转化率 | CPC
   - 可排序（点击列头）
   - 可筛选（列头筛选器）
   - 行内标记: 每行左侧有颜色条（红/绿/灰）
   - 汇总行: 底部显示总计/平均值

3. **AI 标记系统 `keyword-tag-system.tsx`**:
   - 🔴 高ACOS词（ACOS > 阈值）— 标记为"需优化"
   - 🟢 高转化词（转化率 > 阈值）— 标记为"保留"
   - ⚪ 非精准词 — 标记为"建议否词"
   - 每个标记可展开查看具体关键词列表
   - 标记可手动调整

4. **Google Trends 迷你图 `google-trends-mini.tsx`**:
   - 内嵌折线图（recharts）
   - 显示选中关键词的近30天搜索热度趋势
   - 多词对比（最多3条线）

5. **自动调整策略面板（灰度状态）**:
   - 三个开关: 降价 / 加预算 / 否词
   - 开关下方显示 "老品有数据后启用" 提示
   - 灰色遮罩 + 禁用状态
   - 底部说明: "该功能将在老品广告数据积累后自动启用"

---

### Step 14: AI 上架 `/workflows/ai-listing`

**文件结构**:
```
app/workflows/ai-listing/
  page.tsx                              — 主页面（表单向导）
  components/
    listing-stepper.tsx                 — 步骤条（5步）
    input-step.tsx                      — 输入产品信息
    copywriting-step.tsx                — 文案生成（含侵权检测）
    category-match-step.tsx             — 类目匹配
    preview-step.tsx                    — Listing 预览
    publish-step.tsx                    — 上架确认
    title-editor.tsx                    — 标题编辑器（SEO + 侵权检测）
    bullet-editor.tsx                   — 5点描述编辑器
    infringement-detector.tsx           — 侵权词检测组件
    listing-preview-card.tsx            — Amazon 前台样式预览
    mock-data-listing.tsx              — 上架专用 mock 数据
```

**布局**: 表单向导式（步骤条 + 内容区）

```
┌─────────────────────────────────────────────────┐
│ [1 输入] → [2 文案] → [3 类目] → [4 预览] → [5 上架]│
├─────────────────────────────────────────────────┤
│                                                 │
│              当前步骤内容区                        │
│                                                 │
├─────────────────────────────────────────────────┤
│ [上一步]                          [下一步]        │
└─────────────────────────────────────────────────┘
```

#### 步骤1 — 输入产品信息
- 产品关键词输入框
- 1688 链接输入框（自动解析产品信息）
- 竞品 ASIN（可选，用于参考文案）
- 批量模式: CSV 上传（铺货场景，多行关键词/ASIN）

#### 步骤2 — 文案生成（核心！）

**标题编辑器 `title-editor.tsx`**:
- AI 生成 3 个版本标题（A/B/C），标注 SEO 评分
- **侵权词检测 `infringement-detector.tsx`**:
  - 实时扫描输入文字
  - 🔴 红色高亮: 侵权词（竞品品牌词、敏感词、已注册商标词）
  - 🟡 黄色警告: 潜在风险词
  - 底部侵权词列表（可一键清除）
- Rufus 推荐流量优化标注（标签: "Rufus友好" / "需优化"）
- 标题字数统计（Amazon 限制 200 字符）

**5点描述编辑器 `bullet-editor.tsx`**:
- 5 个独立编辑区（每个: 标题 + 描述）
- 每个编辑区都有侵权词检测
- AI 生成按钮（参考竞品文案优化）
- 字数限制提示

**产品详情编辑器**:
- 富文本编辑区
- 侧边竞品文案参考面板（抽屉式，可展开/折叠）
- 侵权词检测

**竞品文案参考**: 点击竞品 ASIN 展开侧边抽屉，显示:
- 竞品标题
- 竞品 5 点描述
- 竞品详情（关键词密度分析）
- 参考来源说明

#### 步骤3 — 类目匹配
- AI 推荐类目 Top 3:
  - 每个推荐: 类目路径 + 匹配度百分比（进度条）
  - 推荐理由
- 手动搜索类目（输入框 + 树形选择器）
- 类目审核状态标识

#### 步骤4 — Listing 预览
- **Listing 预览卡 `listing-preview-card.tsx`**:
  - 模拟 Amazon 前台产品页面样式
  - 标题、价格、图片占位、5点描述、详情
  - 移动端/桌面端切换预览
- 最终侵权检测报告
- SEO 评分面板（标题长度、关键词密度、可读性）

#### 步骤5 — 上架确认
- 最终确认清单
- 「推送到 Amazon」按钮（模拟 API 上架）
- 上架进度指示
- 成功/失败状态反馈

---

### Step 15: 库销比 `/workflows/inventory`

**文件结构**:
```
app/workflows/inventory/
  page.tsx                              — 主页面
  components/
    inventory-overview.tsx              — 顶部库存概览
    inventory-table.tsx                 — 主表格（@tanstack/react-table）
    sku-detail-panel.tsx                — 侧边SKU详情面板
    restock-suggestion.tsx              — AI 补货建议
    sales-trend-chart.tsx               — 销量趋势图
    alert-banners.tsx                   — 滞销/冗余告警条
    mock-data-inventory.tsx             — 库存专用 mock 数据
```

**布局**: 数据仪表盘 + 操作面板
```
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│ 总SKU    │ 正常     │ 预警     │ 滞销     │ 冗余     │
│ 1,234   │ 890     │ 156     │ 42      │ 146     │
├─────────┴─────────┴─────────┴─────────┴─────────┤
│ 搜索: [___________] 筛选: [状态▾] 排序: [库销比▾]  │
├────────────────────────────────┬────────────────┤
│ 库存数据表格                     │ 选中SKU详情     │
│ SKU|产品名|库存|日销|库销比|     │               │
│ 预计断货日|建议补货量|建议补货日│  │ 销量趋势图     │
│ 状态                           │               │
│                                │ AI 补货建议:    │
│ (行颜色: 绿=正常/黄=预警/红=滞销)│ "建议在X月X日   │
│                                │  补货Y件"       │
│                                │               │
│                                │ 滞销处理建议:   │
│                                │ "库存可售≥60天  │
│                                │  建议促销清库"   │
└────────────────────────────────┴────────────────┘
```

**核心功能详解**:

1. **顶部概览 `inventory-overview.tsx`**:
   - 5 个指标卡片（横排）: 总SKU | 正常(绿) | 预警(黄) | 滞销(红) | 冗余(橙)
   - 每个卡片: 大字数字(AnimatedNumber) + 标签 + 占比百分比

2. **库存表格 `inventory-table.tsx`**:
   - 列: `SKU | 产品名 | 当前库存 | 日均销量 | 库销比(天) | 预计断货日 | 建议补货量 | 建议补货日 | 状态`
   - 行颜色编码: 绿色(正常, <30天) / 黄色(预警, 30-45天) / 橙色(注意, 45-60天) / 红色(滞销/冗余, ≥60天)
   - 默认按库销比升序（最紧急排最前）
   - 可排序、可筛选
   - 行点击展开详情面板

3. **SKU 详情面板 `sku-detail-panel.tsx`**:
   - 产品基础信息
   - **销量趋势图** `sales-trend-chart.tsx`: 近90天日销量折线图
   - **AI 补货建议** `restock-suggestion.tsx`:
     - 大字: "建议在 5月15日 补货 2,000 件"
     - 计算逻辑展示: "基于日均销量45件 × 运输周期30天 + 安全库存15天"
   - **滞销检测**:
     - 条件: 库存可售 ≥ 60天
     - 显示: 🔴 告警 + "建议促销清库，避免长期仓储费及占用资金"
   - **冗余库存告警**:
     - 条件: 库存可售 ≥ 60天
     - 显示: 🟠 告警 + 处理建议（降价/清仓/退仓）

4. **告警条 `alert-banners.tsx`**:
   - 顶部固定告警条（如果有滞销/冗余 SKU）
   - 红色横幅: "⚠️ 42 个 SKU 滞销，146 个 SKU 冗余，点击查看详情"

---

### Step 16: 竞品广告分析 `/workflows/competitor-ads`

**文件结构**:
```
app/workflows/competitor-ads/
  page.tsx                              — 主页面
  components/
    analysis-input.tsx                  — 输入区（类目/ASIN）
    keyword-matrix.tsx                  — 关键词矩阵（三维标签云）
    ad-structure-chart.tsx              — 广告结构图表（SP/SB/SD）
    ad-position-heatmap.tsx             — 广告位热力图
    asin-targeting-panel.tsx            — ASIN定向分析（三列对比）
    competitor-table.tsx                — 竞品对比表
    strategy-output.tsx                 — AI 策略输出
    mock-data-competitor.tsx            — 竞品广告专用 mock 数据
```

**布局**: 分析报告式（自上而下滚动）
```
┌─────────────────────────────────────────────────┐
│ 分析输入区: 类目/ASIN [__________] [开始分析]      │
├────────────────────┬────────────────────────────┤
│ 关键词矩阵          │ 广告结构                     │
│ 核心词(12)          │ SP: ████████ 65%            │
│ 长尾词(48)          │ SB: ███ 20%                 │
│ 竞品词(23)          │ SD: ██ 15%                  │
├────────────────────┼────────────────────────────┤
│ 广告位分析           │ ASIN定向分析                 │
│ TOP: ████████      │ 互补 | 防御 | 进攻           │
│ PP: ██████         │ 5个  | 8个  | 7个           │
│ 其他: ████          │                             │
├────────────────────┴────────────────────────────┤
│ 竞品对比表（前20竞品的广告策略一览）                  │
│ 竞品名 | 广告类型 | 核心词 | 广告位 | ASIN定向      │
├─────────────────────────────────────────────────┤
│ AI 策略输出                                       │
│ ┌─进攻策略──┐ ┌─防御策略──┐ ┌─差异化策略──┐        │
│ │ ...      │ │ ...      │ │ ...        │        │
│ └──────────┘ └──────────┘ └────────────┘        │
└─────────────────────────────────────────────────┘
```

**核心功能详解**:

1. **关键词矩阵 `keyword-matrix.tsx`**:
   - 三维标签云: 核心词 / 长尾词 / 竞品词
   - 每个标签: 关键词文字 + 气泡大小(搜索量) + 颜色(竞争度)
   - 点击标签查看详细数据

2. **广告结构图 `ad-structure-chart.tsx`**:
   - 堆叠柱状图（recharts）: SP / SB / SD 占比
   - 每个竞品一根柱子

3. **广告位热力图 `ad-position-heatmap.tsx`**:
   - 三行: TOP / PP / 其他位置
   - 颜色深浅表示广告密度

4. **ASIN 定向分析 `asin-targeting-panel.tsx`**:
   - 三列对比: 互补 | 防御 | 进攻
   - 每列: ASIN 列表 + 策略说明
   - 互补: "针对互补品的ASIN定向广告"
   - 防御: "保护自身品牌的防御性广告"
   - 进攻: "针对竞品的进攻性广告"

5. **竞品对比表 `competitor-table.tsx`**:
   - 前20竞品的广告策略一览
   - 列: 竞品名 | 广告类型(SP/SB/SD) | 核心词 | 广告位(TOP/PP) | ASIN定向(互补/防御/进攻)

6. **AI 策略输出 `strategy-output.tsx`**:
   - 三列面板: 进攻策略 | 防御策略 | 差异化策略
   - 每列: 具体建议列表 + 执行步骤
   - 「一键应用到广告工作流」按钮

---

## 六、Phase 4 — 监控页面优化（3步）

### Step 17: 重写账号风险 `/risk`

**文件结构**:
```
app/risk/
  page.tsx                              — 主页面（大屏监控风格）
  components/
    health-score-gauge.tsx              — 账户健康总分（大字仪表盘）
    dimension-scores.tsx                — 5维度评分
    risk-indicators-table.tsx           — 风险指标表格
    alert-timeline.tsx                  — 告警时间线
    store-isolation-checklist.tsx       — 店铺隔离提醒
    feishu-alert-config.tsx             — 飞书报警配置
    mock-data-risk.tsx                  — 风险专用 mock 数据
```

**布局**: 监控大屏风格
```
┌─────────────────────────────────────────────────┐
│ 账户健康总分            5维度评分                   │
│  [  87/100  ]          订单缺陷 ▓▓▓▓░ 85%        │
│  ● 状态: 良好           迟发率   ▓▓▓▓▓ 92%        │
│                        侵权     ▓▓▓░░ 60% ⚠️     │
│                        绩效通知 ▓▓▓▓░ 80%        │
│                        政策合规 ▓▓▓▓▓ 95%        │
├─────────────────────────────────────────────────┤
│ 风险指标实时表格                                    │
│ 指标 | 当前值 | 阈值 | 状态 | 趋势 | 操作           │
├─────────────────────────────────────────────────┤
│ 告警时间线                                         │
│ 5/9 14:30 ─ [警告] 侵权次数: 本月已发生2次          │
│ 5/9 10:15 ─ [信息] 绩效通知: 新通知待处理            │
│ 5/8 16:00 ─ [已解决] 迟发率已恢复正常               │
├─────────────────────────────────────────────────┤
│ 店铺隔离提醒（展开/折叠）                            │
│ ☑ 邮箱已隔离  ☑ 浏览器已隔离  ☑ 信用卡已隔离        │
│ ☑ 电话已隔离  ☑ 文案风格已差异化  ☐ 操作手法待确认   │
└─────────────────────────────────────────────────┘
```

**关键功能**:
- `health-score-gauge.tsx`: 大字数字 + 圆形进度环 + 状态标签（良好/警告/危险）
- `store-isolation-checklist.tsx`: 亚马逊关联因素 checklist（邮箱/文案风格/电话/信用卡/浏览器/同个操作手法），每次进入店铺时显示
- `feishu-alert-config.tsx`: 每个指标可单独设置报警阈值和推送渠道（飞书webhook）
- 风险预测: 基于历史数据的趋势预测（虚线延伸折线图）

### Step 18: 优化 Agent 管理

- Agent 卡片增加: 当前任务进度、最近执行的工作流、性能指标趋势
- 新增: Agent 工作流分配面板（拖拽分配）
- 新增: Agent 性能对比图

### Step 19: 优化任务中心

- 任务列表增加: 关联工作流标识、执行时间线
- 任务详情增加: 步骤执行日志、输入/输出数据展示
- 新增: 任务模板功能（常用工作流任务一键创建）

---

## 七、Phase 5 — 系统页面优化 + 验证（3步）

### Step 20: 优化记忆系统

- 三区记忆增加: 搜索、版本对比、导入/导出
- 记忆条目增加: 创建时间、最后修改时间、使用频率
- 新增: 记忆图谱可视化（知识关联网络）

### Step 21: 优化自进化页面

- 进化流水线增加: 实时进度动画、阶段详情展开
- 进化记录增加: 性能对比图表（优化前 vs 优化后）
- 新增: 进化历史趋势图

### Step 22: 最终验证

- `pnpm build` 确保无类型错误
- 所有路由可正常访问
- 暗色/亮色主题切换正常
- 响应式布局验证

---

## 八、类型扩展 (`lib/types.ts` 新增)

```typescript
// 工作流状态
export type WorkflowStatus = "idle" | "running" | "completed" | "error" | "warning";

// 工作流元数据
export interface WorkflowMeta {
  id: string;
  name: string;
  icon: string;
  status: WorkflowStatus;
  lastRunAt: string | null;
  lastRunDuration: number | null;
  totalRuns: number;
  successRate: number;
}

// 选品工作流
export interface DataSource {
  id: string;
  name: string;
  platform: string;
  enabled: boolean;
  config: Record<string, unknown>;
  status: "pending" | "scraping" | "completed" | "error";
  progress: number;
}

export interface KeywordData {
  keyword: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  supplyDemandRatio: number;
  concentration: number;
  trend: number[];
  googleTrend: number[];
  aiTag: "potential" | "competitive" | "risky" | null;
}

export interface PainPoint {
  category: string;
  count: number;
  percentage: number;
  examples: string[];
}

export interface PatentRisk {
  type: "appearance" | "invention" | "trademark";
  status: "safe" | "warning" | "danger";
  details: PatentDetail[];
}

// AI 广告
export interface AdKeywordData {
  keyword: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  acos: number;
  conversionRate: number;
  cpc: number;
  aiTag: "highAcos" | "highConversion" | "nonPrecise" | null;
}

export interface BiddingRule {
  suggestedPrice: number;
  actualBid: number;
  capPrice: number;
  adjustment: number;
}

// 库销比
export interface InventoryItem {
  sku: string;
  productName: string;
  currentStock: number;
  dailySales: number;
  inventoryDays: number;
  estimatedStockoutDate: string;
  suggestedRestockQuantity: number;
  suggestedRestockDate: string;
  status: "normal" | "warning" | "critical" | "slow" | "overstock";
  salesTrend: number[];
}

// 竞品广告
export interface CompetitorAdData {
  asin: string;
  brandName: string;
  adTypes: ("SP" | "SB" | "SD")[];
  coreKeywords: string[];
  adPositions: ("TOP" | "PP" | "other")[];
  asinTargeting: ("complementary" | "defensive" | "offensive")[];
}

// AI 作图
export interface GeneratedImage {
  id: string;
  url: string;
  type: "main" | "scene" | "aplus" | "storyboard";
  clipScore: number;
  ctrScore: number;
  overallScore: number;
  isBest: boolean;
  prompt: string;
  model: string;
  seed: number;
}

// AI 上架
export interface ListingDraft {
  titles: string[];
  selectedTitle: number;
  bullets: { title: string; description: string }[];
  description: string;
  suggestedCategories: { path: string; confidence: number; reason: string }[];
  infringementWords: { word: string; type: "danger" | "warning" }[];
  seoScore: number;
}

// 账号风险
export interface RiskIndicator {
  name: string;
  currentValue: number;
  threshold: number;
  unit: string;
  status: "safe" | "warning" | "danger";
  trend: "up" | "down" | "stable";
}

export interface StoreIsolation {
  factor: string;
  label: string;
  isolated: boolean;
  note: string;
}
```

---

## 九、Mock 数据扩展 (`lib/mock-data.ts` 新增)

需要新增以下 mock 数据集（每个工作流页面一套完整数据）:

- `workflowMetas: WorkflowMeta[]` — 7个工作流的元数据和状态
- `researchKeywords: KeywordData[]` — 选品关键词数据（20-30条）
- `dataSources: DataSource[]` — 9个数据源配置
- `painPoints: PainPoint[]` — 痛点聚类数据
- `patentRisks: PatentRisk[]` — 专利风险数据
- `adKeywords: AdKeywordData[]` — 广告关键词数据（30-50条）
- `inventoryItems: InventoryItem[]` — 库存SKU数据（20-30条）
- `competitorAds: CompetitorAdData[]` — 竞品广告数据（前20竞品）
- `generatedImages: GeneratedImage[]` — AI 生成图片数据（8-12张）
- `listingDrafts: ListingDraft[]` — 上架草稿数据
- `riskIndicators: RiskIndicator[]` — 风险指标数据
- `storeIsolations: StoreIsolation[]` — 店铺隔离因素数据

---

## 十、完整文件清单

### 新建通用组件（Phase 1）
- `components/providers/theme-provider.tsx`
- `components/ui/animated-number.tsx`
- `components/ui/data-table.tsx`
- `components/ui/workflow-stepper.tsx`
- `components/ui/page-transition.tsx`
- `components/ui/command-palette.tsx`
- `components/ui/notification-panel.tsx`
- `components/ui/sparkline.tsx`
- `components/ui/status-dot.tsx`

### 新建 Dashboard 组件（Phase 2）
- `components/dashboard/system-pulse.tsx`
- `components/dashboard/workflow-status-panel.tsx`
- `components/dashboard/agent-heartbeat.tsx`
- `components/dashboard/recent-alerts.tsx`
- `components/dashboard/business-trends.tsx`

### 新建工作流页面（Phase 3）
- `app/workflows/product-research/page.tsx` + 10 子组件
- `app/workflows/ai-imaging/page.tsx` + 7 子组件
- `app/workflows/ai-advertising/page.tsx` + 7 子组件
- `app/workflows/ai-listing/page.tsx` + 10 子组件
- `app/workflows/inventory/page.tsx` + 7 子组件
- `app/workflows/competitor-ads/page.tsx` + 8 子组件

### 新建监控组件（Phase 4）
- `app/risk/` 下新增 5 子组件

### 重构文件
- `app/globals.css` — 新色彩系统
- `app/layout.tsx` — next-themes 集成
- `components/layout/sidebar.tsx` — 插件工作流导航
- `components/layout/topbar.tsx` — 命令面板 + 通知
- `app/dashboard/page.tsx` — 全面重写
- `app/risk/page.tsx` — 大屏监控重写
- `app/agents/page.tsx` — 优化
- `app/tasks/page.tsx` — 优化
- `app/memory/page.tsx` — 优化
- `app/evolution/page.tsx` — 优化
- `lib/types.ts` — 新增工作流相关类型
- `lib/mock-data.ts` — 新增7个痛点场景的模拟数据

### 删除文件
- `app/business/operations/page.tsx`
- `app/business/marketing/page.tsx`
- `app/business/finance/page.tsx`
- `app/business/legal/page.tsx`
- `app/business/` (整个目录)
- `components/dashboard/stats-overview.tsx`
- `components/dashboard/agent-status-card.tsx`
- `components/dashboard/task-overview-chart.tsx`
- `components/dashboard/system-metrics.tsx`
- `components/dashboard/risk-alerts.tsx`
- `components/agents/agent-card.tsx`（替换为新设计）

---

## 十一、实施顺序总结

| Phase | 步骤 | 内容 | 预计文件数 |
|-------|------|------|-----------|
| 1 | 1-7 | 基础设施（依赖/主题/CSS/通用组件） | ~12 文件 |
| 2 | 8-10 | 布局重构（侧边栏/顶栏/仪表盘） | ~10 文件 |
| 3 | 11-16 | 6个核心工作流页面 | ~55 文件 |
| 4 | 17-19 | 监控页面优化 | ~8 文件 |
| 5 | 20-22 | 系统页面优化 + 构建验证 | ~3 文件 |

**总计**: 约 88 个文件操作（新建 + 重写 + 删除）

---

## 十二、插件化架构设计（核心扩展性）

用户明确要求: "需要全新功能只需要像新增插件一样，一键增加"

### 工作流注册机制

**文件**: `lib/workflow-registry.ts`

设计一个工作流注册中心，所有插件工作流通过注册表自动发现:

```typescript
interface WorkflowPlugin {
  id: string;                          // 唯一标识: "product-research"
  name: string;                        // 显示名: "选品工作流"
  icon: ComponentType;                 // lucide-react 图标组件
  description: string;                 // 一句话描述
  route: string;                       // 路由: "/workflows/product-research"
  color: string;                       // 主题色: "#3b82f6"
  status: WorkflowStatus;              // 运行状态
  category: "data" | "creative" | "ads" | "listing" | "monitor"; // 分类
  permissions: string[];               // 所需权限
  configSchema: Record<string, unknown>; // 配置 schema
}

// 注册中心
const workflowRegistry = new Map<string, WorkflowPlugin>();

export function registerWorkflow(plugin: WorkflowPlugin) { ... }
export function getWorkflows(): WorkflowPlugin[] { ... }
export function getWorkflowById(id: string): WorkflowPlugin | undefined { ... }
```

### 每个工作流的标准化接口

每个新工作流只需:
1. 在 `app/workflows/[id]/` 创建 `page.tsx`
2. 在 `lib/workflow-registry.ts` 注册元数据
3. 侧边栏自动从注册中心读取并渲染

新增工作流时，侧边栏的"插件工作流"分组会自动显示新条目（含状态灯），无需手动修改 Sidebar 组件。

---

## 十三、文案撰写 — 在 AI 上架工作流中的强化设计

用户第4点痛点"文案撰写"已整合到 AI 上架工作流（步骤2），但作为核心痛点需要特别强化:

### 文案工作台（AI上架步骤2的扩展设计）

**布局**: 三列对比编辑区
```
┌────────────────┬────────────────┬────────────────┐
│ 竞品文案参考     │ AI 生成文案      │ 我的文案编辑     │
│ (类目前20)      │ (多版本)        │ (最终版)        │
│                │                │                │
│ 标题: ...      │ 版本A: ...     │ [编辑区]        │
│ 5点: ...       │ 版本B: ...     │                │
│ 描述: ...      │ 版本C: ...     │ [侵权检测]      │
│                │                │ [SEO评分]       │
│ 关键词密度分析   │ Rufus优化标注   │ [Rufus友好度]   │
│ 文案风格分析    │ 侵权词检测      │                │
└────────────────┴────────────────┴────────────────┘
```

**Rufus 推荐流量优化**（重要！亚马逊已从搜索流量向推荐流量倾斜）:
- 标注文案是否符合 Rufus 推荐逻辑
- 基于 amz123 / toutiao 等参考文章的优化建议
- "Rufus 友好度"评分标签（🟢友好 / 🟡一般 / 🔴需优化）
- 优化建议: "建议增加产品使用场景描述以提升推荐流量"

**Gemini/GPT-4o 文案生成**:
- 分析类目前20的优秀文案模式
- 结合 AI 图片生成地道英文文案
- 文案风格适配: 专业商务 / 生活方式 / 技术参数

---

## 十四、视觉设计细节补充

### 14.1 痛点强调手法

为了让7大核心痛点在前端"突出"展示，采用以下视觉策略:

1. **Dashboard 系统脉搏**: 7个工作流状态一行排列，用颜色和状态灯区分
2. **侧边栏强化**: "插件工作流"分组左侧加琥珀色竖线装饰，是整个侧边栏视觉重心
3. **每个工作流页面顶部**: 全宽的"痛点描述横幅"（带图标的一句话描述当前痛点）
4. **工作流页面 Tab 切换**: 顶部带子标题，如"选品工作流 — 解决选品耗时问题"

### 14.2 数据可视化统一规范

| 数据类型 | 可视化方式 |
|---------|-----------|
| 趋势（时间序列） | 折线图 + sparkline 迷你图 |
| 对比（多个维度） | 堆叠柱状图 / 雷达图 |
| 占比（构成分析） | 环形图 / 饼图 |
| 分布（散点/热力） | 热力图 / 散点图 |
| 流程（步骤/状态） | WorkflowStepper |
| 标签聚合（关键词） | 标签云（气泡大小=权重） |
| 关联（知识/专利） | 网络图 / 树形图 |

### 14.3 空状态设计

每个工作流页面首次访问时显示引导空状态:
- 大图标 + 痛点描述
- "开始使用"主按钮
- 快速入门步骤（3步简要说明）
- 避免用户面对空白页面的困惑
