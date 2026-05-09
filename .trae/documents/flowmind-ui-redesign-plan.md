# FlowMind 前端重设计计划 — 以7大痛点为核心的插件工作流系统

## 一、设计哲学

**视觉方向**: Industrial Data-Science — 参考 Linear 的克制、Bloomberg Terminal 的密度、Vercel Dashboard 的清晰层级。

**核心原则**:

* 每个痛点 = 一个「插件工作流」模块，不是一张卡片

* 拒绝 Card 马赛克，使用 section-based 布局 + 面板 + 数据表格

* 信息密度高但层次分明：标题→指标→操作→详情，四层递进

* 动效服务于数据感知：状态流转、数据刷新、工作流执行都有视觉反馈

**色彩系统重构**:

* 主色: `#f59e0b` (琥珀) — 代表跨境电商的商业本质

* 辅助: `#6366f1` (靛蓝) — Agent/系统层

* 强调: `#10b981` (翡翠) — 成功/在线

* 危险: `#ef4444` (红) — 风险/熔断

* 背景: `#09090b` (真黑) — 极深底色，比当前 `#0a0f1e` 更深沉

**字体升级**:

* 保留 Geist Sans 做正文

* 新增 JetBrains Mono 做数据/代码展示（替换 Geist Mono）

***

## 二、需要安装的新依赖

```
pnpm add framer-motion next-themes @tanstack/react-table
```

* **framer-motion**: 页面过渡动画、工作流节点动效、数据流动画

* **next-themes**: 规范的暗色/亮色模式管理（替换手动 DOM 操作）

* **@tanstack/react-table**: 数据透视表（广告数据分析、库存表格、关键词表格）

***

## 三、新增/重写路由结构

### 重构侧边栏导航 — 按"插件工作流"组织

```
概览
  └── 仪表盘 /dashboard          [重写]

插件工作流（核心区域！占侧边栏最大比重）
  ├── 选品工作流 /workflows/product-research    [新建]
  ├── AI 作图   /workflows/ai-imaging           [新建]
  ├── AI 广告   /workflows/ai-advertising        [新建]
  ├── AI 上架   /workflows/ai-listing            [新建]
  ├── 库销比    /workflows/inventory             [新建]
  └── 竞品广告  /workflows/competitor-ads        [新建]

监控中心
  ├── Agent 管理 /agents          [保留，优化]
  ├── 任务中心   /tasks           [保留，优化]
  ├── 账号风险   /risk            [重写，强化]
  └── 风险熔断   /circuit-breaker [新建]

系统
  ├── 记忆系统   /memory          [保留，优化]
  ├── 自进化     /evolution       [保留，优化]
  └── 设置       /settings        [保留]
```

**删除旧路由** `/business/operations`, `/business/marketing`, `/business/finance`, `/business/legal` — 被6个工作流页面取代。

***

## 四、每个痛点页面的详细设计方案

### 4.1 选品工作流 `/workflows/product-research`

**布局**: 三栏式工作台

* 左栏(240px): 工作流步骤导航（纵向 stepper）

  1. 数据采集配置
  2. 热词趋势分析
  3. 用户差评反推
  4. AI 差异化建议
  5. 产品方案生成

* 中栏(flex-1): 当前步骤的主操作区

* 右栏(320px): 实时数据面板 / AI 分析结果预览

**步骤1 — 数据采集配置**:

* 平台选择器（多选标签）: Amazon / TikTok / YouTube / 1688 / SIF / 卖家精灵 / Fastmoss / Google Trends / 专利检索

* 每个平台可配置采集条件:

  * Amazon: BSR范围、上架时间(6个月新品)、小类前100新品占比

  * TikTok: 热门标签、播放量阈值

  * 1688: 产地、工厂评级

* 「开始采集」按钮 → 显示采集进度（每个平台一行进度条）

**步骤2 — 热词趋势分析**:

* 关键词表格(@tanstack/react-table): 关键词 | 搜索量 | CPC | 竞争度 | 供需比 | 趋势(sparkline) | Google Trends

* 筛选: 高增长 / 低竞争 / 高供需比

* AI 标注: 自动标记"潜力爆款词"

**步骤3 — 用户差评反推**:

* 竞品差评分析面板: 输入 ASIN → 抓取1-2星评论

* NLP 情感分析结果: 痛点聚类（材质 / 设计 / 功能 / 耐用性）

* 痛点词云可视化

* AI 建议: "基于差评分析，建议改进方向：..."

**步骤4 — AI 差异化建议**:

* 展示 AI 分析结果卡片（非通用 Card，而是类似 Notion 的宽幅内容块）:

  * 市场垄断分析: 头部卖家占比（饼图）、品牌词搜索结果（截图式展示）

  * 外部流量依赖度评估: TikTok 流量占比（如果>30% → 风险提示）

  * 专利风险检测: 外观/发明/商标三类专利状态

  * 产品差异化方向: 结构建议 + 外观建议 + 组合建议

  * 卖点设计列表

  * 供应链建议: 1688 优质工厂推荐（按产地分组）

**步骤5 — 产品方案生成**:

* 自动生成的完整方案文档（markdown 渲染）:

  * 产品结构、外观建议（含分析逻辑）

  * 卖点设计

  * 外观图 — 3种风格建议（调用 ComfyUI/SD 生成预览）

  * 包装方案

  * 目标工厂列表

* 可导出 PDF / 发送到飞书

***

### 4.2 AI 作图 `/workflows/ai-imaging`

**布局**: 画廊式工作台

* 顶部: 产品信息输入区（关键词 / ASIN / 产品图上传）

* 主区域: 图片网格（瀑布流/网格切换）

**核心功能区**:

* **图片类型 Tab**: 主图 | 场景图 | A+页面 | 视频分镜

* 每种类型有预设模板（合规尺寸、构图规范）

* 「生成」→ 显示多张候选图

* **AI 评分系统**: 每张图下方显示 CLIP 评分 + CTR 预测分数

* 评分条: 绿色(>80) / 黄色(60-80) / 红色(<60)

* 可勾选"最佳"图片 → 批量下载 / 发送到上架工作流

* **视频脚本区**: 竞品爆款视频分析 + 创意建议 + 分镜板（卡片式时间轴）

***

### 4.3 AI 广告 `/workflows/ai-advertising`

**布局**: 双面板工作台

* 左面板: 广告策略配置

* 右面板: 数据分析结果

**策略配置区**:

* 产品类型选择: 精品 / 精铺

* 精品模式:

  * 关键词来源: 卖家精灵 / SIF / Amazon 前台

  * 筛选: 只保留精准词根词

  * 自动拓展长尾词

  * 每词一个广告组

  * 竞价规则: 后台建议价 - $0.2，超$1则固定$0.5

  * 广告周期: 新品30天内=14天分析周期，老品=每周一7天分析

  * 广告类型: SP / SB / SD 多选

* 精铺模式:

  * 自动收集类目前20竞品关键词

  * 取流量前20关键词

**数据分析区（核心!）**:

* 数据透视表(@tanstack/react-table):

  * 行: 关键词

  * 列: 展示 / 点击 / 花费 / 销售 / ACOS / 转化率 / CPC

  * 可排序、可筛选、可分组

* AI 标记系统（三色标签）:

  * 🔴 高ACOS词（需优化）

  * 🟢 高转化词（标记保留）

  * ⚪ 非精准词（建议否词）

* Google Trends 关键词热度变化（内嵌折线图）

* 自动调整策略面板（当前标记为"未启用"，灰度状态）:

  * 降价 / 加预算 / 否词 — 三个开关

  * "老品有数据后启用" 提示

***

### 4.4 AI 上架 `/workflows/ai-listing`

**布局**: 表单向导式

* 步骤条: 输入 → 文案生成 → 类目匹配 → 预览确认 → 上架

**输入区**:

* 产品关键词 or 1688 链接输入框

* 竞品 ASIN（可选，用于参考）

**文案生成区**:

* 标题生成器:

  * SEO 优化标题（多版本 A/B/C）

  * **侵权词检测**: 实时高亮标红侵权词、敏感词、竞品品牌词

  * Rufus 推荐流量优化标注

* 5点描述生成:

  * 每点独立编辑

  * 同样带侵权词检测

* 产品详情:

  * 富文本编辑器风格

  * 竞品文案参考面板（侧边抽屉）

**类目匹配**:

* AI 推荐类目 Top 3（含匹配度百分比）

* 手动选择/搜索类目

**模板填充 & 上架**:

* 自动生成的 Listing 预览（模拟 Amazon 前台样式）

* 「推送到 Amazon」按钮 → 调用 API 上架

***

### 4.5 账号风险 `/risk`（重写）

**布局**: 监控大屏风格

* 顶部: 账户健康总分（大字仪表盘）+ 5个维度评分（进度半圆）

* 中部: 风险指标实时表格

  * 订单缺陷率 / 迟发率 / 侵权次数 / 绩效通知

  * 每个指标: 当前值 | 阈值 | 状态灯 | 趋势箭头

* 底部: 告警时间线（纵向时间轴，左侧时间，右侧事件卡片）

**关键功能**:

* 店铺隔离提醒: 每次进入店铺时弹出隔离规则 checklist

* 飞书报警配置: 每个指标可单独设置报警阈值和推送渠道

* 风险预测: 基于历史数据的趋势预测（虚线延伸折线图）

***

### 4.6 库销比 `/workflows/inventory`

**布局**: 数据仪表盘 + 操作面板

* 顶部: 库存概览（总SKU数 / 正常 / 预警 / 滞销 / 冗余）

* 主区域: 库存表格(@tanstack/react-table)

  * 列: SKU | 产品名 | 当前库存 | 日均销量 | 库销比(天) | 预计断货日 | 建议补货量 | 建议补货日 | 状态

  * 行颜色: 绿色(正常) / 黄色(预警) / 红色(滞销/冗余)

  * 排序: 按库销比升序（最紧急的排最前）

* 侧边面板: 选中SKU的详情

  * 销量趋势图（时间序列）

  * AI 补货建议: "建议在 X月X日 补货 Y件"

  * 滞销处理建议: "该SKU库存可售≥60天，建议促销清库"

  * 冗余库存告警

***

### 4.7 竞品广告分析 `/workflows/competitor-ads`

**布局**: 分析报告式

* 顶部: 输入类目/ASIN → 启动分析

* 主区域: 分析结果面板

**分析维度**:

* 关键词矩阵: 核心词 / 长尾词 / 竞品词（三维标签云）

* 广告结构: SP / SB / SD 占比（堆叠柱状图）

* 广告位分析: TOP / PP / 其他位置（热力图式展示）

* ASIN 定向分析: 互补 / 防御 / 进攻（三列对比面板）

* 竞品对比表: 前20竞品的广告策略一览

* AI 输出: 对标策略建议（进攻策略 / 防御策略 / 差异化策略）

***

## 五、全局 UI 改进

### 5.1 Dashboard 仪表盘重构

* 去掉4个KPI卡片横排，改为一个"系统脉搏"横幅（单行，左侧大字指标，右侧迷你图表）

* 工作流执行状态面板: 6个插件工作流的实时状态（运行中/空闲/错误），每个是一个紧凑的状态行

* Agent 心跳时间线: 横向时间轴，彩色脉冲点表示各 Agent 的心跳

* 最近告警: 简洁的列表行，而非 Card 堆叠

### 5.2 侧边栏重构

* "插件工作流" 分组增加视觉权重: 每个工作流项显示小型状态灯（绿/灰/黄）

* 工作流项可展开显示"最近一次执行"摘要

* 增加"快速启动"区域: 常用工作流一键触发

### 5.3 顶部栏重构

* 搜索栏改为命令面板(Cmd+K): 可搜索页面、Agent、任务、工作流

* 通知系统: 点击展开通知面板（滑入式），按风险等级分组

* 系统状态: 显示当前活跃工作流数 + Agent在线数

### 5.4 全局动效系统

* 页面切换: framer-motion page transition (淡入+微上移)

* 数据刷新: 数字变化时的滚动数字动画

* 工作流执行: 节点间的连线流动动画

* 状态变更: 状态灯的渐变过渡

* 列表项: 进入时的 stagger 动画

### 5.5 表格组件标准化

* 统一的 @tanstack/react-table 配置

* 固定表头、虚拟滚动（大数据量）

* 行内状态指示器

* 列排序、筛选、列可见性控制

* 导出 CSV/Excel

***

## 六、实施顺序

### Phase 1: 基础设施升级

1. 安装新依赖 (framer-motion, next-themes, @tanstack/react-table)
2. 集成 next-themes 替换手动主题切换
3. 重构 globals.css（新色彩系统 + 动画基础类）
4. 创建通用 AnimatedNumber 组件（数字滚动动画）
5. 创建通用 DataTable 组件（@tanstack/react-table 封装）
6. 创建通用 WorkflowStepper 组件（纵向步骤导航）
7. 创建通用 PageTransition 组件（framer-motion）

### Phase 2: 布局重构

1. 重构 Sidebar — 插件工作流分组 + 状态灯
2. 重构 TopBar — 命令面板 + 通知面板
3. 重构 Dashboard — 系统脉搏 + 工作流状态

### Phase 3: 核心工作流页面（按优先级）

1. 选品工作流 — 最复杂，5步向导 + 三栏布局
2. AI 广告 — 数据透视表 + 策略配置
3. 库销比 — 数据表格 + AI 补货建议
4. AI 上架 — 表单向导 + 侵权检测
5. AI 作图 — 画廊 + AI 评分
6. 竞品广告 — 分析报告

### Phase 4: 监控页面优化

1. 重写账号风险页面 — 大屏监控风格
2. 优化 Agent 管理页面
3. 优化任务中心页面

### Phase 5: 系统页面优化

1. 优化记忆系统页面
2. 优化自进化页面
3. 验证: pnpm build 通过

***

## 七、新建文件清单

### 新增通用组件

* `components/ui/animated-number.tsx`

* `components/ui/data-table.tsx`

* `components/ui/workflow-stepper.tsx`

* `components/ui/page-transition.tsx`

* `components/ui/command-palette.tsx`

* `components/ui/notification-panel.tsx`

* `components/ui/sparkline.tsx`

* `components/ui/status-dot.tsx`

### 新增工作流页面

* `app/workflows/product-research/page.tsx` + 子组件

* `app/workflows/ai-imaging/page.tsx` + 子组件

* `app/workflows/ai-advertising/page.tsx` + 子组件

* `app/workflows/ai-listing/page.tsx` + 子组件

* `app/workflows/inventory/page.tsx` + 子组件

* `app/workflows/competitor-ads/page.tsx` + 子组件

### 重构的文件

* `app/globals.css` — 新色彩系统

* `app/layout.tsx` — next-themes 集成

* `components/layout/sidebar.tsx` — 插件工作流导航

* `components/layout/topbar.tsx` — 命令面板 + 通知

* `app/dashboard/page.tsx` — 全面重写

* `app/risk/page.tsx` — 大屏监控重写

* `app/agents/page.tsx` — 优化

* `app/tasks/page.tsx` — 优化

* `lib/types.ts` — 新增工作流相关类型

* `lib/mock-data.ts` — 新增7个痛点场景的模拟数据

### 删除的文件

* `app/business/operations/page.tsx`

* `app/business/marketing/page.tsx`

* `app/business/finance/page.tsx`

* `app/business/legal/page.tsx`

* `app/business/` (整个目录)

