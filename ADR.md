# ADR.md — FlowMind 架构决策记录

> 本文记录 FlowMind 跨境智能编排系统的**已采纳/已替代**架构决策（ADR，MADR-lite 格式）。
> 新建分支/新功能前先浏览：若本文件已有相关决策，**遵守它**；做了新决策，**在此登记一行**（照格式追加）。
> 权威设计文档：`docs/architecture/2026-09-03-cluster-native-service-architecture.md`（集群）与 `docs/architecture/2026-09-03-nextjs-fullstack-architecture.md`（全栈）——ADR 记录「为什么这么定」，架构文档规定「现在是什么样」。

---

## 决策速查表

| # | 决策 | 日期 | 状态 |
|---|---|---|---|
| ADR-001 | 数据源自举 + 三态缓存 + refresh 闸门（TikHub 成本纪律） | 2026-08-26 | ✅ 采纳 |
| ADR-002 | Cordis 4.0 前后端同构微内核取代 RAK 引擎 | 2026-09-02 | ✅ 采纳 |
| ADR-003 | M3/M4/M5 三层动态生成（组件→工作流→页面） | 2026-09-02 | ✅ 采纳 |
| ADR-004 | 微信发布端到端走 MCP（rak-flowmind 技能链路） | 2026-09-02 | ✅ 采纳 |
| ADR-005 | 数据层 sql.js → Supabase（过渡）→ 集群 PG | 2026-09-03 | ✅ 采纳（Supabase 退役中） |
| ADR-006 | 集群原生化服务架构：两服务 · 三支柱 · 三角色 | 2026-09-03 | ✅ 采纳（权威） |
| ADR-007 | 零配置服务目录 `lib/cluster` 为唯一端点解析入口 | 2026-09-03 | ✅ 采纳 |
| ADR-008 | MCP 是前端↔后端的唯一通道，契约冻结 | 2026-09-03 | ✅ 采纳 |
| ADR-009 | 云密钥唯一持有人 = 后端；前端零密钥、凭据不落库 | 2026-09-03 | ✅ 采纳 |
| ADR-010 | UI 层禁 import `lib/server/**`（eslint 强制分层） | 2026-09-03 | ✅ 采纳 |
| ADR-011 | 模型/生图统一走集群 LiteLLM 网关 | 2026-09-03 | ✅ 采纳 |
| ADR-012 | 设计系统：token 体系 + GSAP 优先 + shadcn 级组件（DESIGN.md 唯一裁决） | 2026-09-04 | ✅ 采纳 |
| ADR-013 | Agent 三面一体 UI（dock/sidebar/stage），React state 为唯一真源 | 2026-09-05 | ✅ 采纳 |
| ADR-014 | Agent 自主周期默认关闭（防自动 LLM 循环） | 2026-09-05 | ✅ 采纳 |
| ADR-015 | 长任务跨实例断点续跑（Redis 快照 + 续跑工具） | 2026-09-05 | ✅ 采纳 |
| ADR-016 | workspaces 插件注册表 + journeys manifest 驱动导航/旅程 | 2026-09-05 | ✅ 采纳 |
| ADR-017 | 数据真实化（os/PG 真实聚合；废弃假健康分） | 2026-09-05 | ✅ 采纳 |
| ADR-018 | 阿里国际站铺货为主线（TOP 协议直连发布、草稿态管链） | 2026-09-05 | ✅ 采纳（等 key） |
| ADR-019 | Mastra 承载长流程工作流（listing-pipeline / b2b-daily-trends） | 2026-09-05 | ✅ 采纳 |
| ADR-020 | 状态管理五层（SWR/nuqs/zustand/Context/useState） | 2026-09-05 | ✅ 采纳 |

---

## ADR-001：数据源自举 + 三态缓存 + refresh 闸门
- **日期**：2026-08-26 · **状态**：✅ 采纳
- **背景**：TikHub 等外部 API 按调用计费，页面切换重复请求既慢又费钱。
- **决策**：数据统一走 SWR（`revalidateOnFocus: false`，防切标签页触发付费 API、断网重连静默重验、去重/重试 2 次）；新鲜度控制收敛为 `lib/utils/refresh-gate.ts` 闸门，仅显式刷新/过期才请求上游；上游能力不足时**如实标注 degraded/warning/cache，绝不编造数据**（数据诚实原则）。
- **结果**：RSC 首屏 + SWR 客户端链路双缓存；`daily-refresh` 定时批量保鲜。代价是存在最长新鲜度窗口内的旧数据（产品可接受）。

## ADR-002：Cordis 4.0 前后端同构微内核取代 RAK 引擎
- **日期**：2026-09-02 · **状态**：✅ 采纳
- **背景**：`lib/rak`（Coordinator/Mesh/Conflict/Consensus）和 Agent 自主循环是上一代设计，未进入运行时主链；对话编排需要一个前后端共享推理骨架。
- **决策**：引入 Cordis 4.0 微内核——后端 `src/kernel/*`（生命周期/DI/事件 + model-adapter/tool-registry/mastra-engine/pi-subagent/spec-store 等插件），前端 `lib/kernel/*`（ui-actions 页面即工具 + page-context 快照 + component-kit 动态组件）。`lib/rak` 判死代码（0-import，仅历史参考）。
- **结果**：`app/api/agent/chat` 为统一 SSE 对话入口；12 个内核工具（9 本地 + 3 MCP 镜像）统一编排。

## ADR-003：M3/M4/M5 三层动态生成
- **日期**：2026-09-02 · **状态**：✅ 采纳
- **背景**：Agent 不能只聊天，要能「生产界面」。
- **决策**：动态产物分三级——M3 `render_component`（对话内动态组件，`@json-render/react` / `react-generative-ui` 渲染）、M4 `plan/run_workflow`（动态工作流，落 `wf_workflow_specs`，可「保存为团队 SOP」）、M5 `generate_page`（动态页面 `app/p/[slug]`，落 `wf_page_specs`）。产物由 BFF 落库、前端渲染。
- **结果**：AgentDrawer 可生成并挂载组件/工作流/页面；`e2e/team-sop-m4.spec.ts`、`rsc-features.spec.ts` 覆盖。

## ADR-004：微信发布端到端走 MCP
- **日期**：2026-09-02 · **状态**：✅ 采纳
- **背景**：公众号排版/发布依赖重逻辑与密钥，不适合在浏览器侧做。
- **决策**：前端只经 MCP 调 `rak-flowmind`（账号管理/排版/发布/群发/状态轮询技能）；前端 `lib/server/services/wechat.service.ts` 仅做编排与轮询回写。
- **结果**：`/content-studio/wechat` 端到端可用；设计稿 `docs/superpowers/specs/2026-09-02-wechat-e2e-publish-design.md`。

## ADR-005：数据层 sql.js → Supabase（过渡）→ 集群 PG
- **日期**：2026-09-03 · **状态**：✅ 采纳（Supabase 退役中）
- **背景**：sql.js 单文件库无法支撑多副本/长任务；Supabase 云作为过渡被引入，但云上依赖与「全自托管」冲突。
- **决策**：终局 = 集群 PG（`postgres` 驱动直连）。Supabase 云**全面退役、不留兼容层**，`supabase/migrations/*` 转普通 DDL 迁移。多租户归属列已由 `00013_saas_groundwork.sql` 预留终端形态。
- **结果**：新代码一律走 `lib/server/db`（pg/redis/mongo/milvus/embeddings/b2b-kb）；`prisma/schema.prisma` 为遗留，不扩展。

## ADR-006：集群原生化服务架构（两服务 · 三支柱 · 三角色）✅ 权威
- **日期**：2026-09-03（经三次拍板，最终形态）· **状态**：✅ 已采纳 · 真源 `docs/architecture/2026-09-03-nextjs-fullstack-architecture.md`
- **背景**：单体 Next 服务职责不清、密钥分散、部署形态僵化。
- **决策**：系统 = **两个服务**——
  1. **前端全栈**（本仓，Next.js 16，UI 角色/core-ui）＝ **BFF × 前端 Agent 内核 × MCP 客户端**三支柱融合，单镜像三角色 `FLOWMIND_ROLE=web|worker|cron`；域名 `flowmind.xrak.top`（人）+ `flowmind.api.xrak.top`（机器），同一服务双域名、浏览器边缘同源、无 CORS。
  2. **后端 flowmind**（父目录 rak-flowmind → 集群 `flowmind-mcp`，core-api 仅内网）＝ 重技能 + 云密钥唯一持有者。
- **结果**：前端零密钥、只认 MCP 契约；worker/cron 角色不再依赖 web 进程；CI 一次 bump 同 SHA 更新三角色清单。

## ADR-007：零配置服务目录 `lib/cluster` 为唯一端点解析入口
- **日期**：2026-09-03 · **状态**：✅ 采纳
- **背景**：业务代码散写 `process.env.X ?? "http://…"` 导致端点漂移、设置页出现基础设施输入框。
- **决策**：`lib/cluster/services.ts` 为全仓**唯一**基础设置端点解析入口（app/data/ai/search/obs 五层目录）；解析优先级 = 显式 env 逃生门 > 运行形态自动检测（cluster/dev）> 目录默认；凭据只声明 env key 名、不携值；UI 渲染只走脱敏 `publicServiceView`。
- **结果**：`/api/cluster/services` 只读状态展示；MCP 地址、生图 key 等输入框全部退役；新增外部依赖 = 目录加一行。

## ADR-008：MCP 是前后端唯一通道，契约冻结
- **日期**：2026-09-03 · **状态**：✅ 采纳
- **背景**：多协议（MCP/A2A/REST）并存易混乱；后端接口变更会静默破坏前端。
- **决策**：契约冻结面 = MCP `POST /mcp`（入参 `inp` 包裹）、`GET /api/v1/manifest`、`GET /api/v1/health`、SkillResult 信封 `{ok, skill, data, error, metrics:{degraded}}`。前端对后端**只认契约、不认实现**；`lib/mcp` 提供 MCP/A2A/REST 三适配器 + 意图路由 + 服务注册表；可靠性三件套（懒连接/断路器/指数退避重试，断会话自动重建）。
- **结果**：`degraded/warning/cache` 诚实标注必须透传到 UI（与 ADR-001 一致）；浏览器经同源反代 `/backend-mcp/*`，永不接触内网地址。

## ADR-009：云密钥唯一持有人 = 后端；前端零密钥、凭据不落库
- **日期**：2026-09-03 · **状态**：✅ 采纳
- **背景**：密钥散落前端包/数据库/UI 输入框，是泄漏与「凭什么由前端持有 TikHub key」的问题。
- **决策**：TikHub/阿里/生图/LLM 上游直连密钥一律由后端经 K8s Secret 注入；前端 `NEXT_PUBLIC_*` 白名单只剩端点提示；Settings 只放业务凭证/登录态，**不出现任何基础设施端点/密钥输入框**。`lib/server/vault.ts` 加密落库的业务凭据（如微信 appSecret）同样不上送到浏览器。
- **结果**：git 历史干净，`.env` 不入库；阿里等「key 未到位」时链路照常备好、通电即用（ADR-018）。

## ADR-010：UI 层禁 import `lib/server/**`
- **日期**：2026-09-03 · **状态**：✅ 采纳
- **背景**：组件直连服务层会让同构边界崩溃、密钥与 DB 逻辑泄入浏览器 bundle。
- **决策**：分层方向 F1——UI 层（components/hooks/stores/lib/kernel/lib/ui）禁止 import `lib/server/**`（eslint `no-restricted-imports` 强制）；服务端能力只经 RSC props、`/api/*`、Server Actions 到达 UI；跨边界类型放 `lib/shared`。
- **结果**：eslint 即门禁，错误 import 直接 CI 失败。

## ADR-011：模型/生图统一走集群 LiteLLM 网关
- **日期**：2026-09-03 · **状态**：✅ 采纳
- **背景**：各服务直连各家模型/生图 API，凭据与计费分散。
- **决策**：模型与生图统一经集群 `ai.litellm` 网关（`LITELLM_MASTER_KEY`）；内核推理直连网关，不经过后端（后端如需模型同样走网关）；`ai_config` 只留业务偏好键。
- **结果**：provider 凭据 env 优先于 KV；一处换 key、全局生效。

## ADR-012：设计系统统一（token 体系 + GSAP 优先 + shadcn 级组件）
- **日期**：2026-09-04 · **状态**：✅ 采纳 · 唯一裁决 `DESIGN.md`
- **背景**：全站出现平行颜色/字号/animation 实现，视觉手感不统一。
- **决策**：制定 `DESIGN.md` 为视觉与交互唯一标准——Token 唯一真源 `globals.css`（`@theme inline`，Tailwind v4 无 config）；层级用 surface 阶差 + hairline；动画**默认 GSAP**（`data-animate` 钩子 + `autoAlpha` + `clearProps` + reduced-motion 降级，只动 transform/opacity），framer-motion 限量保留；原子件达到 shadcn/ui 级（forwardRef + cva + cn + asChild）；现成库优先裁决顺序（能力地图）。状态管理五层 SWR/nuqs/zustand/Context/useState（ADR-020）。
- **结果**：提交前自检清单十条；反模式清单十四条明令禁止；`bun run lint/build` + 对应 e2e 为唯一自动化门禁。

## ADR-013：Agent 三面一体 UI（dock/sidebar/stage）
- **日期**：2026-09-05 · **状态**：✅ 采纳
- **背景**：抽屉展开时主内容挤压不同步、路由切换残留显示、stage 推挤页面。
- **决策**：三态由 `stores/agent-presence.ts` 的 `surface`（React state）作为**唯一真源**；aside 宽与主内容 margin 由 ResizeObserver 实时联动（marginRight 跟随 aside 实际宽度，sidebar 模式；stage/dock 归零）；aside `min-w-0` 防内容撑开；进入 dashboard 用 `immersiveExited` 延迟卸载到折叠动画完成；GSAP 单一 timeline 同步三列宽切换。
- **结果**：`e2e/agent-actions.spec.ts` 覆盖；切路由不残留、宽幅同步、Esc 逐步退出 stage。

## ADR-014：Agent 自主周期默认关闭
- **日期**：2026-09-05 · **状态**：✅ 采纳
- **背景**：Agent 自动 LLM 周期循环（旧自主运行时）浪费令牌、行为不可预期。
- **决策**：迁移脚本 `scripts/migrate-agent-cycles-off.ts` 将全部存量 Agent（seed 6 + 动态 9）`cycleConfig.enabled = false`；Agent 周期改为显式指令/场景驱动，不再 fire-and-forget 自嗨（`instrumentation.ts` 已去掉按角色启动循环的旧计划）。
- **结果**：LLM 调用只发生在用户需要时；`cycleConfig.enabled=true` 仍保留作显式开关。

## ADR-015：长任务跨实例断点续跑（Redis 快照）
- **日期**：2026-09-05 · **状态**：✅ 采纳
- **背景**：多副本滚动升级/崩溃时，进行中的 Run 在另一实例上无法恢复。
- **决策**：run 态落 Redis 快照（`fm:wf:run:<runId>:snapshot`，30min TTL，键名前缀对全文检索友好）；续跑工具复用上游已产步骤（如 `runImagingGenerate` 结果）、按需重新派发事件，挂起态恢复不从头。
- **结果**：`listing-pipeline` 等长流程可在 pod 重启后继续；无强一致依赖（金丝雀期最终一致可接受）。

## ADR-016：workspaces 插件注册表 + journeys manifest 驱动
- **日期**：2026-09-05 · **状态**：✅ 采纳
- **背景**：侧边栏/编排入口散落硬编码；新子系统接入成本高。
- **决策**：导航与空间由 `lib/workspaces/registry.ts` 单一注册表派生（7 空间：command-deck/insight/content-workshop/listing-ops/growth/monitor/system，侧边栏/命令面板/编排中心同源）；旅程由 `lib/journeys/registry.ts` manifest 驱动（3 正式 + 4 骨架，步骤带 workspaceId/href/agentHint/handleSelector）。
- **结果**：新增空间 = manifests 加文件 + 注册表登记一行，框架代码零改动；`data-agent-action` 钩子支撑旅程内 Agent 动作衔接。

## ADR-017：数据真实化（os/PG 真实聚合；废弃假健康分）
- **日期**：2026-09-05 · **状态**：✅ 采纳
- **背景**：Dashboard/风控/进化等页面存在硬编码假数据，误导决策。
- **决策**：Dashboard 数据层全部改为 os/PG SQL 聚合（stats/system/business/alerts/trends/SOP run/overview 零假数据）；工作流/记忆/进化/竞品维度同步真实化；**风控健康分废案**（不再维护假健康分，改为真实可用性信号）。
- **结果**：顶部「系统真相总览」条 = 服务健康（PG/Redis/MCP/阿里/模型）+ 用量六项 + 铺货漏斗，纯真实。

## ADR-018：阿里国际站铺货为主线（TOP 协议直连发布）
- **日期**：2026-09-05 · **状态**：✅ 采纳（等 key 通电）· 见 `TODO.md` P0
- **背景**：原 Amazon 语境发布桩是「假链路」；阿里国际站 Accio 是对标对象。
- **决策**：`B2BService.publishListing` 走 TOP 协议 HMAC-MD5 直连 `alibaba.icbu.product.add`；草稿态管理（draft→uploading→uploaded/failed，`wf_b2b_listings`）；铺货全链路流水线（趋势→RAG 选品→AI 推荐→批量草稿+主图，limit≤6）；状态回查 `GET /api/b2b/listing/status-overview`；旧 Amazon 桩删除、旧路由改 410。
- **结果**：链路备好，`ALIBABA_APP_KEY/SECRET/SESSION` 一到即通电；页内 L2 `publishListingToAlibaba` 需用户确认。

## ADR-019：Mastra 承载长流程工作流
- **日期**：2026-09-05 · **状态**：✅ 采纳
- **背景**：手写流程状态机难维护、无可视化、难恢复。
- **决策**：引入 `@mastra/core`，长流程建模为 Mastra workflow（`lib/server/mastra/workflows/listing-pipeline.ts`、`b2b-daily-trends.ts`）；`run-registry` + Redis 快照衔接 ADR-015；工具层分 local/mcp/selfhost 三类进 tool-registry。
- **结果**：流程定义即代码、可断点续跑、可被 Agent 编排复用。

## ADR-020：状态管理五层（SWR / nuqs / zustand / Context / useState）
- **日期**：2026-09-05 · **状态**：✅ 采纳 · 细则 `DESIGN.md` §6
- **背景**：请求响应被拷进 zustand 当第二数据源、筛选条件用本地 state、selector 整店解构引发重渲染。
- **决策**：五层裁决顺序固定——**服务端数据 → SWR**（`useFetch` 唯一取数通道，写后 `mutate` 失效）；**进链接/刷新保留 → nuqs**（类型 parser + 默认值）；**跨路由/远亲共享 → zustand**（细粒度 selector、组件外 `getState()`、凭据永不进 store）；**注入式服务 → Context**（value useMemo）；**其余 → 局部 state**。禁止第二套全局状态库。
- **结果**：`e2e/dashboard.spec.ts` 等页面切换即回、刷新不丢状态；反模式清单明确禁止手写取数三态机。

---

## 维护约定

- 新决策按 `## ADR-###：<一句话标题>` 追加，并在速查表登记一行；涉及架构真源的决策同步更新 `docs/architecture/`。
- 决策被取代时改状态为 ⏹ 已替代并指向新 ADR，**不删除原文**（保留演化轨迹）。
- 引用代码路径一律以当前 `src/kernel` / `lib/server/**` / `lib/kernel` 为准（旧 `lib/rak`、`lib/services` 路径已迁移，勿按旧文定位）。