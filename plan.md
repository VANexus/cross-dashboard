# FlowMind AI-Native Agent 设计方案(Plan)

> 状态:待评审 · 2026-09-01
> 关联仓库:`X:\xrak\yuz\cross-dashboard`(FlowMind 跨境电商智能编排系统)
> 本次交付目标:AI-Native Agent 交互设计 + 视觉概念稿(HTML/WebGL 原型)+ Next.js 生态依赖设计

---

## 1. 意图摘要

当前系统的 Agent 以"独立对话工具"形态存在(OrchestratorPanel 抽屉式面板),与业务界面割裂。
本次重设计的目标:**把 Agent 溶解进产品本身** —— 它不是用户"打开去聊"的功能,而是产品每
个界面里随时在场、可就地调用的智能层。核心理念:

> **Agent 不是对话框,而是操作系统的守护进程。**

三个设计支柱:

1. **就地智能(Inline Intelligence)** —— 用户在数据所在的地方召唤 AI,而不是把数据搬进聊天窗。选中表格行 → 就地出现 AI 操作条;图表旁 → "解读此图";文本块 → "改写/翻译"。
2. **环境在场(Ambient Presence)** —— Agent 以"呼吸感"的视觉状态(WebSocket 流式活动)持续告知"我活着、我在看、我在处理",而非靠气泡消息。
3. **主动介入(Proactive Surface)** —— Agent 主动把洞察推到对应业务界面的上下文位置(风险页的异常标注、Dashboard 的机会卡片),用户确认/驳回,而非被动提问。

---

## 2. 用户与场景

- **主用户**:跨境电商运营/操盘手,每天在 Dashboard、选品、Listing、风险、工作流五类页面间切换。
- **核心 Job**:面对一堆数据时,缩短"看到 → 理解 → 决策 → 执行"的链路。
- **反模式(要消灭的)**:打开聊天抽屉 → 描述"我的数据长什么样" → AI 给一段文字 → 用户自己回去操作。

## 3. 交互架构:四层智能层

### L1 · 指令层 —— 全局命令面板(⌘K)
- 任意页面 `⌘K` 唤起,输入自然语言或 `>` 前缀进入 Agent 模式。
- 面板内直接渲染**可执行的 Agent 计划**(步骤 DAG,来自 RAK 引擎),每步可展开看工具调用,可一键"执行"或"仅执行第 N 步"。
- 上下文自动注入:当前页面 + 当前选中对象(如"Shopee 泰国站 SKU-4821")。

### L2 · 就地层 —— Inline AI Blocks
| 位置 | 交互 | 产出 |
|---|---|---|
| 数据表格 | 行选中浮出 AI 操作条(分析/预测/生成 Listing) | 就地展开的结论卡,可写回 |
| 图表卡片 | 角落"✦ 解读"悬停点 | 覆盖层:趋势归因 + 异常标注叠加在原图上 |
| 文本编辑(Content Studio) | 选区浮动菜单 | 流式改写,diff 对比视图 |
| 工作流画布 | 节点右键 | "让 Agent 优化此节点" → 参数建议 diff |

### L3 · 在场层 —— Ambient Agent Presence
- 顶部常驻 **Agent 心跳胶囊**:活动强度用 WebGL 极光场的湍流度表达(空闲=平缓极光,执行=高湍流+色相偏移),点击展开活动流。
- 活动流不是聊天记录,而是**时间线遥测**:"选品 Agent 完成了 12 个竞品扫描 · 发现 2 个风险 · 正在共识投票"。
- 每个业务页面角落有一个微缩极光节点,表示该域的 Agent 状态。

### L4 · 主动层 —— Proactive Insights
- Agent 的洞察以**就地卡片**出现在归属位置:风险页的异常行高亮 + 建议动作;Dashboard 的"机会雷达"卡。
- 卡片三态:建议 → 已采纳(写回系统)→ 已驳回(反馈进记忆系统 `lib/repositories/memory.repository.ts`)。

## 4. 视觉系统

- **基调**:延续现有深色主题(`--primary: #f59e0b` 琥珀 / 深色 `#1a1a1c` 表面),新增 Agent 专属的第二视觉通道:冷调青色系(`oklch(0.78 0.14 200)` 附近)与琥珀形成"人类操作 vs AI 活动"的双色语义,全局 accent 仍以琥珀为主。
- **标志性视觉(WebGL 极光场)**:全屏极低透明度的流动生成式极光作为 Agent 在场的环境层 —— 湍流强度与 Agent 实际活动量数据绑定;空闲时近乎静止,执行任务时以流光扫过。这是本次"哇塞"的核心,但克制:只在 Agent 活动时被感知。
- **字体**:现有 Geist Sans/Mono + Sora 展示字体不变;Agent 遥测/工具调用一律 Geist Mono,tabular-nums。
- **动效纪律**:遥测流式更新 150ms 状态确认;极光为连续场动画但遵守 `prefers-reduced-motion`(降级为静态渐变);卡片进入 200–300ms。

## 5. Next.js 生态依赖设计

目标:在**现有技术栈(Next 16 / React 19 / Tailwind v4 / Zustand / Bun)**上以最小摩擦接入,不引入与 React 19 冲突的库。

### 新增依赖
| 包 | 用途 | 备注 |
|---|---|---|
| `ai` ^5.x (Vercel AI SDK) | 核心:流式协议、tool-calling、`useChat`/`streamUI` | 官方支持 React 19 / Next 16 |
| `@ai-sdk/react` | 前端 hooks(useChat、useObject) | 与 `ai` 同版本 |
| `@ai-sdk/anthropic` | Claude Provider(替换/扩展现有自研 provider 适配层) | 演示模式保留现有 mock |
| `zod` ^4 已有 | 生成式 UI 的结构化输出 schema | 复用 |
| `three` ^0.160 已有 | WebGL 极光场(或原生 WebGL2 无依赖实现,原型阶段用原生) | 已在 package.json |

### 明确不引入
- `@assistant-ui/react` 等重对话 UI 套件 —— 与"去对话框"方向冲突;
- LangChain.js —— RAK 引擎已承担编排,叠加会造成双编排层;
- 独立向量库 —— 记忆层沿用现有 SQLite(sql.js) Repository 模式。

### 架构接线(与现有分层对齐)
```
app/api/agent/stream/route.ts   → ai.streamText/streamObject,Node runtime,SSE
lib/agent-runtime/real-brain.ts → 改为封装 @ai-sdk/anthropic(替换 raw fetch)
lib/rak/mesh.ts                 → tool 定义从现有 service 层生成(zod → tool map)
stores/agent-presence.ts (zustand) → 订阅 SSE,驱动心跳胶囊 + 极光湍流 uniform
components/agent/*              → 指令面板 / InlineBlock / 遥测时间线 / 洞察卡
```
流式 UI 策略:tool-call 结果按 `toolName → 组件` 注册表渲染生成式 UI(表格片段用 @tanstack/react-table,图表用 recharts,均为已有依赖,零新增重量)。

## 6. 本次交付物(生成阶段)

1. **`ai-native-agent.html`** —— 单文件高保真交互概念稿:FlowMind Dashboard 背景上,演示 L1–L4 四层交互(⌘K 面板、行内 AI 条、心跳胶囊 + 遥测、主动洞察卡),底层为原生 WebGL2 流动极光场,湍流随模拟 Agent 活动变化。全中文界面,零外部请求。
2. **依赖与接线说明** —— 已含于本文档第 5 节,评审通过后可直接落库到 `docs/`。

## 7. 验收检查

- [ ] 原型中不存在"传统聊天抽屉/气泡对话"作为主交互
- [ ] 四层智能交互至少各演示 1 个可触发流程
- [ ] WebGL 极光 60fps,DPR 适配,`prefers-reduced-motion` 降级
- [ ] 心跳状态与模拟 Agent 活动数据联动(空闲/思考/执行/共识)
- [ ] 琥珀/青双色语义不互相污染:人类主操作仍是琥珀
- [ ] 全中文文案,对比度达标(hover/focus 不降低)
- [ ] 依赖清单与现有 Bun + Next 16 + React 19 兼容,无版本冲突标注

## 8. 开放问题(TODO)

- [ ] Agent 活动的 SSE 是否复用现有 `app/api/orchestrate` 或新增 `/api/agent/stream`?(倾向新增)
- [ ] 极光层是否进生产(作为 AppShell 背景组件),或仅概念稿?(待确认性能预算)
- [ ] 主动洞察卡的"写回"权限边界:哪些操作可自动执行,哪些必须人工确认?

## Next step

1. 评审本方案,直接在本文档上修改/批注;
2. 确认后回复"开始设计",我将生成交付物 1(`ai-native-agent.html` 交互概念稿,含 WebGL 极光);
3. 如需先看视觉方向,可回复"出方向卡"。
