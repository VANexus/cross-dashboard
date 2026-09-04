# FlowMind 前端全栈架构 v3 — BFF × 前端 Agent 内核 × MCP 客户端（2026-09-03）

> 状态：**权威设计**（v2 的「一镜像三角色」并入本文第 5 节；定位表述以本文为准）。
> 拍板（2026-09-03 三次纠偏，最终形态）：
> ① **系统 = 两个服务**：**前端全栈**（本仓 `cross-dashboard`，Next.js 16，**UI 角色 / core-ui**）＋ **后端 flowmind**（父目录 `rak-flowmind`，Python 技能后端 → 集群 `flowmind-mcp`，core-api/内网）。
> ② **前端全栈 = 三支柱融合**：**BFF** ＋ **前端 Agent 内核** ＋ **MCP 客户端**，长在同一个 Next.js 进程/镜像里。
> ③ 「全栈」不等于「干后端的活」：前端只做**为 UI 供数、页面内智能、技能调用**；重技能、云密钥、上游对接全部归后端 flowmind。
> ④ 先别管其他东西：后端 flowmind 的集群化（P3 独立轨道）、鉴权、多租户——本文只给**边界契约**，不展开实现。
> Next 16 API 事实已对照 `node_modules/next/dist/docs/` 核实（proxy.ts / instrumentation / use cache / cacheComponents / streaming / self-hosting / open-telemetry）。

---

## 1. 两个服务的边界（契约先于实现）

```
浏览器（边缘同源 · flowmind.xrak.top）
        │
┌───────▼───────────────────────────────────────────────────────────┐
│  flowmind —— 前端全栈（Next.js 16 · core-ui · UI 角色）             │
│                                                                    │
│   支柱一 BFF          支柱二 前端Agent内核        支柱三 MCP客户端    │
│   app/api + RSC       src/kernel(cordis)+       lib/content +     │
│   + Actions + SWR     lib/kernel(ui-actions/    lib/discovery     │
│   「为UI供数」         page-context) + M3/M4/M5  「调后端技能」      │
│                       「页面内智能」                                  │
│   自有数据：集群 PG（UI态/工作流规格/页面规格/任务/设置KV）              │
└───────────────────────────────┬───────────────────────────────────┘
                                │ MCP Streamable HTTP（/mcp）
                                │ 发现：/api/v1/manifest · /api/v1/health
┌───────────────────────────────▼───────────────────────────────────┐
│  flowmind-mcp —— 后端 flowmind（rak-flowmind · core-api · 仅内网）  │
│  Python FastMCP 技能层：重技能 + 云密钥唯一持有者 + 上游供应商对接      │
└────────────────────────────────────────────────────────────────────┘
```

| 事项 | 前端全栈（本仓） | 后端 flowmind（rak-flowmind） |
|---|---|---|
| 页面/交互/动态生成产物（M3/M4/M5） | ✅ 唯一责任方 | — |
| UI 态数据（工作流规格/页面规格/任务/设置/缓存） | ✅ 自有（集群 PG，P1） | — |
| 重技能（热榜/长尾/上架/生图/微信发布/内容流水线…） | 只**调用** | ✅ 实现与执行 |
| 云密钥（TikHub/阿里/生图 key/LLM 上游直连…） | ❌ 零持有 | ✅ 唯一持有（Secret 注入） |
| 模型编排（内核推理） | ✅ 直连 LiteLLM 网关 | —（后端内部如需模型，同样走网关） |
| 长任务执行 | 入队/展示进度 | ✅ 执行（或前端 worker 消费队列触发） |
| 鉴权 | 浏览器会话（proxy.ts 占位，未启用） | 内网专属，无公网路由 |

**契约冻结面**（双方改接口必须同步）：MCP `POST /mcp`（入参 `inp` 包裹）、`GET /api/v1/manifest`（技能清单 + 可靠性画像）、`GET /api/v1/health`、SkillResult 信封 `{ok, skill, data, error, metrics:{degraded}}`。前端对后端**只认契约、不认实现**。

---

## 2. 支柱一：BFF（为 UI 供数）

载体：`app/api/**` route handlers ＋ RSC/islands ＋ Server Actions ＋ 客户端 SWR。

**薄壳纪律**：

- route handler = `withDb + parseBody → service → success()`；handler 不写业务。
- BFF service 只干三件事：**聚合**（把多个技能结果拼成页面数据）、**缓存**（为 UI 省往返）、**自有数据读写**（UI 态 PG 表）。
- 禁止：持有任何上游密钥、自行实现业务技能、同步等待长任务。
- 跨端契约面：`/api/*`（移动端/脚本/外部集成经 `flowmind.api.xrak.top`）；页面内交互优先 Server Actions——两者在 service 层汇合。

**数据策略（Next 原生三态缓存）**：

- 首屏：islands/RSC + `use cache` + `cacheLife(profile)` + `cacheTag(域)`。
- 交互：既有 SWR hooks 不动（边缘同源 `/api` 的客户端缓存层，新鲜度指示已对齐）。
- 失效闭环：写成功 → `revalidateTag(域)` + `use-data-changed` mutate——「保存后清 degraded 缓存」的口头约定收敛为唯一标准链路。
- 多副本：Full Route Cache 实例本地 → 金丝雀期最终一致可接受；强一致业务读走 PG。
- 图片：`images.remotePatterns` 白名单（平台 CDN + MinIO `s3.app.xrak.top`）；产物终局落 MinIO（P1 后）。

---

## 3. 支柱二：前端 Agent 内核（页面内智能）

内核是**前端资产**——它理解页面、操作页面、生成页面，这些能力天然属于 UI 角色：

- **载体**：`src/kernel`（cordis 微内核：model-adapter / tool-registry / mastra-engine / pi-subagent）＋ `lib/kernel`（ui-actions L0/L1/L2 风险分级、page-context 快照上报、动态组件）。
- **模型**：`ai.litellm`（集群目录）直连——内核推理不经过后端。
- **工具**：本地工具（local-tools）＋ **MCP 技能镜像**（支柱三发现的技能注册进 tool-registry，内核对它们一视同仁地编排）。
- **三层动态生成**：M3 对话内组件 → M4 动态工作流（落 `wf_workflow_specs`，"保存为团队 SOP"）→ M5 动态页面（`app/p/[slug]`，落 `wf_page_specs`）——产物由支柱一落库、由前端渲染。
- **运行约束**：
  - 内核会话状态 → Redis（TTL + 断线续传，金丝雀滚动不断会话）；
  - 后台节律（Agent 生命循环等）→ **worker 角色**，不占 web；
  - 内核自己**零密钥、零上游直连**：推理借 LiteLLM，干活借 MCP。

---

## 4. 支柱三：MCP 客户端（与后端 flowmind 的唯一通道）

载体：`lib/content/mcp-client.ts`（ContentMCPClient）＋ `lib/discovery/*`（MCPAdapter/registry）＋ `lib/cluster`（寻址）。

- **寻址零配置**：`lib/cluster` 目录 `flowmind.mcp`（cluster = `flowmind-mcp.core-api.svc:8001/mcp`；dev = 本机 `127.0.0.1:8001/mcp`；`FLOWMIND_MCP_URL` 逃生门）——已落地。
- **发现**：`/api/v1/manifest` → 技能清单（input/output schema、category/tags、可靠性画像）→ 供给：内核工具注册（支柱二）＋ 技能市场页渲染。
- **执行**：Streamable HTTP `callTool`，入参按契约包 `inp`；返回 SkillResult 信封——**降级诚实标注（degraded/warning/cache）必须透传到 UI**，这是产品的数据诚实原则。
- **可靠性三件套（已实现）**：懒连接复用、断路器（连续环境错误 → OPEN → 冷却半开）、指数退避重试（仅 environment/timeout；skill 错误不重试）；会话失效（后端重启）自动 teardown + 重建。
- **浏览器侧**：技能市场页的发现与调用经**同源反代** `/backend-mcp/*`（Traefik → flowmind-mcp），浏览器永不接触内网地址——`/api/cluster/services` 的 `browserUrl` 已按此实现。

---

## 5. 运行形态：一个镜像、三角色（前端内核的后台支撑）

三支柱共享一份构建产物；角色由 `FLOWMIND_ROLE` 决定，**全部属于前端全栈服务**（不是"后端"）：

| 角色 | 进程 | 承载 | 形态 |
|---|---|---|---|
| `web`（默认） | node server.js | 页面 / RSC / SSE / Actions / BFF `/api`；内核按请求驱动 | Rollout ×2 金丝雀 |
| `worker` | bun run scripts/worker.ts | Agent 生命循环、队列消费（长任务触发/进度回填）、跨副本事件广播 | Deployment ×1，Redis 租约锁保单跑 |
| `cron` | bun run scripts/cron/*.ts | 日历型任务（08:00 推送、B2B 保鲜） | K8s CronJob |

- 同一 SHA：CI 一次 bump 同时更新三个清单，角色间语义永不漂移。
- `instrumentation.ts` 按角色装配：OTel register ＋ `ROLE=worker` 才启动循环（web 进程不再 fire-and-forget `agentRuntime.start()`）。
- SSE（内核对话/事件流）：streaming route handler；集群 `/api` 路由挂禁压缩/禁缓冲中间件；滚动期 `Last-Event-ID` 续流。

---

## 6. 目录与边界（F1 落点）

```
app/                    路由层（pages/islands/loading/error + api BFF 薄壳）
components/ hooks/ stores/  表现层与前端状态（client）
lib/
├─ ui/                  前端专用（渐进迁入）
├─ kernel/              内核前端侧：ui-actions / page-context / 动态组件
├─ shared/              同构契约：types + 跨边界类型（如 crawler）
├─ mcp/                 ★ MCP 协议层（支柱三）：ContentMCPClient（服务端消费）+
│                       discovery（manifest/adapter/registry，含浏览器侧技能发现状态）
├─ server/              ★服务端专属（UI 层禁止 import，eslint 已强制）
│   ├─ services/  repositories/   BFF 业务与数据访问（P1 后 = PG 直连）
│   ├─ db/                        数据层（P1 换 postgres.js）
│   ├─ ai/                        模型适配（LiteLLM）
│   ├─ mastra/  agent-runtime/  orchestrator/  rak/  ziniao/  crawlers/  vl/  image-gen/
│   └─ vault.ts  api-helpers/response/validation
├─ cluster/             零配置服务目录（已落地）
├─ agent/ journeys/ skills/ workspaces/ content/ utils/   前端/共享侧模块（允许 UI import）
src/kernel/             cordis 微内核（服务端装配，仅 server 侧可达）
instrumentation.ts      角色装配（FLOWMIND_ROLE）+ F4 OTel 挂点（已落骨架）
proxy.ts                Next 16 Proxy（原 Middleware）：鉴权占位（已移根目录）
scripts/worker.ts  scripts/cron/   非 web 角色入口（F2 落）
```

import 四律：① `lib/server/**` 只准被 `app/api`、islands、server components、`scripts` import；② UI↔后端仅三通道：RSC props、`/api/*`+SWR、Server Actions；③ 端点/凭据只经 `lib/cluster`；④ route handler 无业务。

---

## 7. 集群映射与发布

| 项 | flowmind（前端全栈） | flowmind-mcp（后端） |
|---|---|---|
| ns / GitLab | core-ui / core-ui | core-api / core-api（rak-flowmind 仓库） |
| 域名 | `flowmind.xrak.top`（人，xrak-wildcard-tls，坑#21）＋ `flowmind.api.xrak.top`（机器流量，api-wildcard-tls）——**同一服务双域名** | 无公网路由；浏览器经同源 `/backend-mcp` |
| 镜像 | `harbor…/core-ui/flowmind:{SHA8}` | `harbor…/core-api/flowmind-mcp:{SHA8}` |
| 发布 | 金丝雀（web）+ 同 SHA 的 worker/cron | 金丝雀（P3 独立轨道） |
| Secret | `flowmind-env`：PG / Redis / LiteLLM key（**无任何上游供应商密钥**） | `flowmind-mcp-env`：全部云密钥 |
| 资源 | web 2×(250m–1CPU / 512Mi–1Gi)；worker 1×(250–500m / 256–512Mi) | 按技能负载另议 |
| 可观测 | instrumentation 装 OTel；stdout→Loki；Grafana RED | 同（rak-observability 规范） |

> 命名：旧脚手架的 `flowmind-ui` **更名为 `flowmind`**（`deploy/gitops/flowmind-ui/` → `deploy/gitops/flowmind/`，F1 执行）。

---

## 8. 迁移路线（F 轨；P1 数据层 / P3 后端服务化为并行轨道）

| 阶段 | 内容 | 验收门 |
|---|---|---|
| **F1 分层落目录 ✅ 已落地** | `lib/server·lib/shared·lib/mcp` 物理迁移 + 全仓 import 改写 + eslint `no-restricted-imports` 边界（components/hooks/stores/lib/kernel/lib/ui 禁入 `lib/server`）+ `instrumentation.ts` 角色骨架 + `proxy.ts` 移根目录 + gitops 更名 `flowmind`；越界类型契约（如 `CrawlResult`）提升到 `lib/shared` | 边界 lint / tsc / build 全绿；无 UI→server 越界 import |
| **F2 角色分离** | scripts/worker.ts 承接 agent-runtime 循环 + Redis 租约；web 删除循环自启；日历任务 → CronJob | 双副本 web + 单 worker：心跳无重复；租约失效 < TTL 恢复 |
| **F3 队列化与无状态化** | jobs/ 框架（Redis Stream）；长任务（微信/爬虫/生图）入队+jobId+进度 SSE；内核会话 Redis 化、事件总线 pub/sub、SSE 续流 | 长任务不占 HTTP 超时；金丝雀滚动期会话可恢复 |
| **F4 缓存与发现收敛** | islands 全量 `use cache`+tag 化、revalidateTag 闭环；技能市场页经 `/backend-mcp` 同源发现（配合 P3） | 写后读一致 ≤1s；技能页浏览器可达 |
| （并行 P1） | PG 直连替换 supabase-js（前文档 §4） | `grep supabase = 0` |
| （并行 P3） | rak-flowmind 服务化：镜像 + core-api 金丝雀 + Secret 下沉 + 内网化 | `curl flowmind-mcp.core-api.svc:8001/api/v1/health` |

## 9. 明确不做（本期）

- ❌ 在前端实现业务技能或持有上游密钥（违反第 1 节边界 = 架构红线）；
- ❌ 独立后端服务（Node/Go/双镜像拆分）——后端已有且只有 flowmind-mcp；
- ❌ 浏览器直连上游供应商、直连内网 svc 地址；
- ❌ 鉴权/多租户落地（proxy.ts 与归属列占位已在）。
