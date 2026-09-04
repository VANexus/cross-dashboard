# FlowMind 集群原生化服务架构（v2 · 2026-09-03）

> 状态：**已拍板，P0 落地中**
> 决策记录（2026-09-03 用户拍板）：
> ① 网络拓扑 = **边缘同源反代**（浏览器只见 `flowmind.xrak.top`，Traefik 按路径分流 UI / API / MCP）；
> ② 数据层 = **全面替换**：直连集群 PostgreSQL（pg-main），Supabase 云与 PostgREST 兼容层**一律不留**，supabase-js 全量退役；
> ③ 配置模型 = **服务化零配置**：flowmind MCP、LLM、PG、Redis、MinIO 等基础设施端点与密钥**不再出现在任何 UI 输入框与前端 DB KV**，由服务目录自动解析 + K8s Secret 注入；
> ④ **SaaS 多租户本期不做**，只保留归属列与 auth 占位。
> 权威集群规范：`rak-infra` skill（`/home/xrak/rak-cluster.md` 为真源）；本文与集群规范冲突时以集群规范为准。
>
> **⚠️ 2026-09-03 二次拍板（最新）**：本文中的「flowmind-api（Bun+Hono 独立后端）」拆分方案**作废**——项目保持 **Next.js 全栈单服务**（一镜像三角色 web/worker/cron、双域名单服务、`lib/server` 分层），权威设计见 `2026-09-03-nextjs-fullstack-architecture.md`。本文以下部分**仍然有效**：零配置服务目录（§3）、数据层直连集群 PG（§4）、LiteLLM（§7）、凭据模型（§8）、CI/CD 与金丝雀（§10）、可观测（§11）；§5 与 §12 的 P2 行按新文档 F 轨执行。

---

## 0. 一页结论

FlowMind 从「Next.js 一体化 + Supabase 云 + 本机手起 flowmind MCP + 设置页手填地址和密钥」升级为
「**集群三服务 + 全自托管数据面 + 零配置服务目录**」：

| 服务 | ns | 域名 | 角色 | 发布 |
|---|---|---|---|---|
| `flowmind-ui` | core-ui | `flowmind.xrak.top` | Next.js 16 纯前端（页面/组件/hooks/SWR/动态生成 UI） | 金丝雀 |
| `flowmind-api` | core-api | `flowmind.api.xrak.top`（浏览器流量走同源 `/api`，此域留给外部集成） | Bun + Hono 后端：REST/SSE API、cordis 内核、mastra 编排、pi 子代理、调度 | 金丝雀 |
| `flowmind-mcp` | core-api | 仅内网（auth 模型 v2：内部服务不暴露公网） | rak-flowmind（Python FastMCP，streamable-http）：技能执行层 + 云密钥持有者 | 金丝雀 |

集群依赖（全部自托管，端点由服务目录解析）：
**PG**（pg-main）· **Redis**（缓存/会话/刷新闸）· **MinIO**（图片与产物对象存储）· **LiteLLM**（统一模型网关，替代散落的 LongCat/AllIn/mimo key）· **SearXNG**（内网搜索）· **OTel/Loki/Prometheus**（可观测）。

**极客时代的终点**：`FLOWMIND_MCP_URL` 手填、设置页里的 MCP 地址框、LongCat/AllIn API Key 输入框、代码里硬编码的 Supabase 云 URL/anon key、`127.0.0.1:8001` 默认值——全部退役。用户视角：打开设置页只看到「集群服务 · 自动连接 · 绿色状态」，业务凭证（阿里店铺 session、渠道登录态、推送 webhook）才保留输入框。

---

## 1. 背景：现状盘点与债务清单

2026-09-03 勘察数据（cross-dashboard @ 3813013）：

| 债务 | 现状证据 | 规模 |
|---|---|---|
| MCP 端点显式配置 | `app/settings/b2b/page.tsx` 手填「MCP HTTP 地址」；`lib/content/mcp-client.ts` 默认 `http://127.0.0.1:8001/mcp` | 3 处配置面（UI/env/默认值） |
| 后端密钥放前端 DB | `ai_config` KV 表存 `b2b_longcat_api_key`、`b2b_allin_api_key` 等，设置页明文录入 | 6+ 个密钥字段 |
| 数据层外部依赖 | `lib/db/index.ts` 硬编码 Supabase 云 URL + anon key 兜底 | 27 个 service 文件直接用 supabase-js |
| AI 端点外部依赖 | `lib/ai/index.ts` DEFAULT_CONFIG 指向 `token-plan-cn.xiaomimimo.com` | provider 三级优先级最底层 |
| 前后端未分离 | 111 个 `app/api/**/route.ts` + 41 个 SSR island（19 页）+ 内核/调度/MCP 客户端全在 Next.js 进程内 | 整仓 |
| 部署缺位 | 无 Dockerfile / CI / k8s 清单 | — |

集群侧已就绪（rak-infra 2026-09-02 大重建版）：ns 三分层 + 域名四层 + GitLab CI→Kaniko→Harbor→ArgoCD→Argo Rollouts 金丝雀全链路、PG/Redis/Mongo/MinIO/EMQX 数据层、LiteLLM/SearXNG/gotenberg 应用层、OTel/Loki/Prometheus 可观测。

---

## 2. 目标拓扑

```
                         浏览器（零密钥 · 单一来源 flowmind.xrak.top）
                                            │ HTTPS (xrak-wildcard-tls ⚠坑#21)
                              ┌─────────────▼──────────────┐
                              │   Traefik（边缘 · *.xrak.top 层）│
                              │  按路径分流（边缘同源反代）：      │
                              │  /api/*   → flowmind-api        │
                              │  /backend-mcp/* → flowmind-mcp  │（浏览器技能发现，可选）
                              │  /*       → flowmind-ui         │
                              └──┬────────────┬────────────┬───┘
                                 │            │            │
              ┌──────────────────▼──┐  ┌──────▼───────┐  ┌─▼────────────────────┐
              │ core-ui              │  │ core-api      │  │ core-api             │
              │ flowmind-ui          │  │ flowmind-api  │  │ flowmind-mcp         │
              │ Next.js standalone   │  │ Bun + Hono    │  │ Python uv · :8001/mcp│
              │ （纯前端 + SSR 壳）    │  │ REST + SSE +  │  │ FastMCP 技能层        │
              │                      │  │ 内核 + 调度    │  │ （云密钥唯一持有者）    │
              └──────────────────────┘  └──────┬───────┘  └──────────────────────┘
                                               │ 集群内 svc DNS（服务目录解析）
        ┌───────────┬───────────┬──────────────┼──────────────┬───────────────┐
        ▼           ▼           ▼              ▼              ▼               ▼
   pg-main-rw  redis.database minio-api   litellm.agentic  searx.agentic  flowmind-mcp
   :5432        :6379          :9000       :4000/v1         :8080          :8001/mcp
   (flowmind 库) (缓存/闸)      (S3 桶)     (模型网关)        (内网搜索)      (仅内网)
```

### 2.1 边缘同源反代（决策 ①）

- 浏览器**永远只访问** `https://flowmind.xrak.top`。UI 与 API 的分离发生在**部署与代码层**，不发生在浏览器层。
- 收益：CORS 消灭、cookie/SSE 同源直通、前端代码 `fetch('/api/...')` 一行不改（dev 用 `next.config.ts` rewrites 代理到本地 API 服务，行为一致）。
- `flowmind.api.xrak.top`（api-wildcard-tls，API 层 Traefik：限流/gRPC/无压缩流式友好）保留给：外部系统直连、未来的开放接口、机器对机器。
- **流式注意点**：`*.xrak.top` 前端层默认优化是「静态缓存、压缩」——`/api/*` 路由必须挂独立 middleware 关压缩/缓冲（SSE），或对 `/api` 前缀走 API 层 entrypoint 的内部转发。上线前用一条 SSE 长会话验证不缓冲（见 §10 验证清单）。
- 认证模型 v2 对齐：flowmind 自带登录（当前自用暂无鉴权，见 §9 占位）+ `rak-api-ratelimit`；`flowmind-mcp` 属「内部专属」类，**不建公网路由**。

### 2.2 三服务的进程职责边界

| 关注点 | 归属 | 说明 |
|---|---|---|
| 页面/组件/动态生成 UI（M3/M5 渲染层） | flowmind-ui | 不 import 任何 `lib/services`、不触 DB |
| REST API + SSE（现 111 个 route handler 的家） | flowmind-api | Hono 路由 = 现 `app/api` 逐域迁移，handler 逻辑原样复用 |
| cordis 内核、mastra 引擎、pi 子代理、工具注册 | flowmind-api | 对话入口 `/agent/chat` 在此进程 |
| 工作流调度（daily-refresh、B2B 保鲜、心跳） | flowmind-api | 从 setInterval/外部 cron 收敛为服务内调度器（Redis 分布式锁防多副本重复） |
| 技能执行 + 云密钥（TikHub/阿里/生图/LLM 上游） | flowmind-mcp | 密钥只进它的 K8s Secret env |
| 数据 | 集群 PG（flowmind-api 唯一写入口） | UI 永不直连 DB |

---

## 3. 零配置服务目录（决策 ③ 的机制核心）

新目录 `lib/cluster/`——**全仓唯一**的基础设施端点解析入口。

### 3.1 解析优先级

```
显式 env 覆盖（开发调试逃生门） > 运行形态自动检测 > 目录内置默认
```

- 运行形态：`RAK_RUNTIME=cluster|dev` 可显式钉；否则 `KUBERNETES_SERVICE_HOST` 存在 ⇒ cluster，否则 dev。
- cluster 形态 → 集群内 svc DNS；dev 形态 → mesh 入口 `RAK_MESH_HOST`（默认 `100.121.213.4`）NodePort 或本机回环。
- 凭据：一律 `process.env`（cluster 形态由 K8s Secret 注入；dev 形态读工作区 `.env`），目录只声明「读哪个 key」，不含值。

### 3.2 目录内容（v1）

| id | cluster 默认 | dev 默认 | env 覆盖 | 凭据 env |
|---|---|---|---|---|
| `flowmind.mcp` | `http://flowmind-mcp.core-api.svc:8001/mcp` | `http://127.0.0.1:8001/mcp` | `FLOWMIND_MCP_URL` | —（零密钥） |
| `flowmind.api` | `http://flowmind-api.core-api.svc:8080` | `http://127.0.0.1:8080` | `FLOWMIND_API_URL` | — |
| `data.postgres` | `pg-main-rw.database.svc:5432` / db=`flowmind` | `100.121.213.4:30432` | `PGHOST/PGPORT/PGDATABASE` | `PGUSER`、`PGPASSWORD`（Vaultwarden→Secret `flowmind-api-env`） |
| `data.redis` | `redis.database.svc:6379` | `100.121.213.4:30379` | `REDIS_URL` | 密码内嵌 URL |
| `data.minio` | `http://minio-api.minio.svc:9000` | `https://s3.app.xrak.top` | `S3_ENDPOINT` | `S3_ACCESS_KEY/S3_SECRET_KEY` |
| `ai.litellm` | `http://litellm.agentic.svc:4000/v1` | mesh NodePort（**待核实**，先 env） | `AI_LLM_BASE_URL` | `LITELLM_MASTER_KEY`（Secret `litellm-env` 同步） |
| `search.searx` | `http://searx.agentic.svc:8080` | —（内网专属） | `SEARX_URL` | — |
| `obs.otel` | `http://otel-collector.monitoring.svc:4317` | `100.121.213.4:4317` | `OTEL_EXPORTER_OTLP_ENDPOINT` | — |

> 规则：**新增任何外部依赖 = 目录加一行**；业务代码禁止再写 `process.env.X ?? "http://…"` 的散装默认值。

### 3.3 前端怎么看（浏览器不拿 svc DNS）

- `GET /api/cluster/services`（flowmind-api 实现，先从 Next 侧 BFF 过渡）返回脱敏视图：`{ id, name, layer, mode, health }`。cluster 形态**不回传内网 URL**；dev 形态回传本机 URL 便于排障。
- 浏览器需要直连 MCP 的场景（discovery 页 tools 列表）：目录给出 `browserUrl`——cluster 形态 = 同源 `/backend-mcp/mcp`（Traefik 反代），dev 形态 = `http://127.0.0.1:8001/mcp`。
- 设置页 infra 卡片 = 此端点 + 健康徽标，**只读**。

### 3.4 设置页退役清单（决策 ③）

| 控件 | 处置 |
|---|---|
| FlowMind MCP「HTTP 地址」输入框 | **删**，改为「集群服务 · 自动连接」状态卡（探活= MCP initialize 握手） |
| LongCat API Key / AllIn API Key 输入框 | **删**。LLM/生图上游统一走 LiteLLM 网关；flowmind 侧技能密钥进其 Secret env |
| Supabase 数据库健康卡 | **删**（P1 完成后由「集群 PG / Redis」状态卡替代） |
| 浏览器 CDP 地址、TikTok/IG 会话、阿里 TOP AppKey/Secret/Session、飞书/企微 webhook | **保留**——这些是「业务凭证/登录态」，属于用户数据，不是基础设施配置 |

---

## 4. 数据层：集群 PG 直连（决策 ②）

**原则：不要 PostgREST 兼容层、不要 supabase-js 残留、不要双写灰度——一次性换心脏，按文件分批改，最后一步切换。**

### 4.1 目标形态

- 驱动：`postgres`（postgres.js，Bun/Node 双运行时兼容，tagged-template SQL、连接池、事务、`POSTGRES` URL 一行配置）。
- 唯一入口：`lib/db/pg.ts` 导出 `sql`（池）+ `tx()`；`getDb()/CompatDatabase` 与 supabase-js 全仓移除；`repository` 与 `service` 直接写参数化 SQL。
- 连接：`lib/cluster` 目录解析（host/port/db/凭据 env）。集群内走 `pg-main-rw.database.svc:5432`；开发机走 mesh `:30432`。
- Schema：现有 `supabase/migrations/00001..00013` 转为**普通 PG DDL**（剥离 Supabase 专属：`anon/authenticated` role grants、`rls` 开启语句保留注释态——归属列留、RLS 策略 SaaS 阶段再启用）；放 `db/migrations/`，`scripts/migrate.ts` 幂等执行 + `schema_migrations` 水位表。
- 库初始化：`rak-db-init.sh flowmind flowmind`（用户级密码入 Vaultwarden，Secret 进 core-api/flowmind-api-env）。

### 4.2 数据搬迁（一次性）

```
Supabase 云 ──pg_dump（仅 data，--no-privileges --no-owner）──►  psql | pg-main flowmind 库
校验：逐表 count + 抽样 md5；ai_config 密钥类 KV 不搬（按 §3.4 退役）
```

### 4.3 代码迁移策略（27 个 service + repositories + islands 取数点）

1. **S0**：`lib/db/pg.ts` 上线（新代码只准用它），旧 `getSupabase()` 冻结不再扩散；
2. **S1**：按域分批改写调用面（批 1：settings/b2b/content 读写密集；批 2：workflows/dashboard/risk；批 3：agent/memory/evolution/journal；批 4：kernel spec-store、mastra、wechat/crawler）——每批 tsc+build+E2E 绿再进下一批；
3. **S2**：删除 `@supabase/supabase-js` 依赖、`lib/db/index.ts` 云兜底、`supabase/` 目录归档、settings 里 Supabase 健康卡；
4. **验收**：`grep -r "supabase" app lib src hooks scripts` = 0（迁移历史 SQL 目录除外）；锁文件无 supabase 包。

> 事务与并发红利：`refresh-gate`、B2B 保鲜等原先受 PostgREST 无事务限制的逻辑，S2 后可用 `sql.begin()` 收敛。

---

## 5. 前后端分离路线（决策 ① 的工程展开）

> **本节已被取代（2026-09-03 二次拍板）**：不再拆 Hono 独立后端，改为 Next.js 全栈单服务 + 一镜像三角色。分离的正确展开（分层目录、worker/cron 角色、无状态化）见 `2026-09-03-nextjs-fullstack-architecture.md` §3–§4；下文仅作历史参考。

### 5.1 仓库形态：同仓双运行时，渐进绞杀

```
cross-dashboard/
├── app/                # ← 只剩页面/islands/loading/error（core-ui 构建输入）
├── components/ hooks/ lib/kernel/   # UI 侧
├── lib/{services,repositories,db,cluster,ai,rak,agent-runtime,ziniao,crawlers}/
│                     # 服务端库（lib/ 保持运行时无关，UI 包禁止 import）
├── server/             # ✨ 新后端入口：Bun + Hono（core-api 构建输入）
│   ├── index.ts        # 挂 /healthz、/api/*（逐域迁移的路由）
│   ├── compat/next-route.ts  # 绞杀期适配：NextRequest 风格 handler → Hono
│   └── jobs/          # 调度收敛：daily-refresh、agent 心跳（Redis 锁）
└── deploy/             # Dockerfile、CI、gitops 模板
```

- **绞杀顺序**（按耦合从低到高）：b2b/热榜/只读数据 → settings/cluster → workflows CRUD → agent chat(SSE)/kernel → wechat/crawler（长任务）→ 调度类。每迁一域，`app/api/<域>` 删除，Traefik `/api/*` 切到 flowmind-api；未切期间 Next 的 `/api/*` 保持兜底，行为一致。
- **islands（41 个）处置**：SSR 取数是分离的唯一大障碍。策略 = island 降级为纯壳（零取数，保留骨架屏），数据全部走**既有 hooks + SWR**（c56ad40 已把客户端取数迁到 SWR，缓存/去重/新鲜度指示现成）。`cacheComponents` 语义不变。
- **SSE（agent/chat）**：浏览器继续 `fetch('/api/agent/chat')` 同源；dev 下 `next.config.ts` rewrites 代理到 `127.0.0.1:8080`。服务端侧内核（cordis/pi/mastra）随路由一起进 flowmind-api，`src/kernel` 不动语义。
- UI 镜像跑 `output: 'standalone'`（node alpine）；API 镜像 oven/bun。

### 5.2 分离后的部署差异对照

| 维度 | 现在 | 目标 |
|---|---|---|
| 进程 | Next 单进程全包 | UI / API / MCP 三服务独立扩缩 |
| 发 UI 改动 | 重启即断内核会话 | 金丝雀只滚 core-ui；长任务/会话在 API |
| 数据访问方 | UI 服务端 + 未来所有端 | 只有 flowmind-api（单一写入口，审计/限流点收敛） |
| 密钥面 | 前端 DB + env + 云 | 只在 flowmind-api / flowmind-mcp 的 Secret |

---

## 6. flowmind MCP 服务化（rak-flowmind 仓库侧改造清单）

1. **镜像**：`python:3.12-slim` + `uv sync --frozen` 多阶段；入口 `flowmind-mcp-http`（uvicorn :8001，路径 `/mcp`）；健康探针 = 现成 `GET /api/v1/health`。
2. **部署**：core-api ns，Rollout 金丝雀（同 flow 五件套）；**仅集群内**（NetworkPolicy：只有 core-api/core-ui 可达），无 IngressRoute。
3. **密钥下沉**：`rak-flowmind/.env` 的内容全部改由 Secret `flowmind-mcp-env` 注入（TIKHUB_*、ALIBABA_*、LONGCAT/ALLIN 或改用 LiteLLM 网关、生图 key、飞书/企微 webhook 执行侧凭据）。`.env.example` 更新为「集群部署时由 Secret 提供」。
4. **技能存储**：`localize_*` 等技能若有落盘需求 → MinIO 桶（S3 endpoint 从 `FLOWMIND_S3_ENDPOINT` 目录 env 注入）。
5. **发现面不变**：`/api/v1/manifest`、`/api/v1/health` 保持（`MCPAdapter` 已按此约定实现），flowmind-api 与浏览器经反代消费。
6. **仓库接入**：GitLab `core-api/flowmind-mcp` group/project + Harbor 同名项目 + robot `core-api+core-api-ci`（注意 `$` 坑 → CI 变量 base64 方案）。

---

## 7. AI 层：LiteLLM 统一网关

- `lib/ai` 的 provider 工厂不再直连各家：`baseUrl` 默认取目录 `ai.litellm`，`apiKey` 取 `LITELLM_MASTER_KEY`；**AIConfigError 文案改为**「集群模型网关未就绪」而非「请在设置中配置 API Key」。
- `ai_config` KV 表语义收窄：只留「业务偏好」（模型名、温度、max tokens 的租户级覆盖），**不再存 base_url/api_key**（现存密钥行在 P1 S2 清理，key 迁移进 Secret/LiteLLM 配置）。
- 模型注册表放 LiteLLM 侧（deployment：longcat、mimo、生图模型…），FlowMind 只引用逻辑模型名；换上游 = 改 LiteLLM 配置，零代码变更。
- 用量与成本天然在 LiteLLM/langfuse 可观测（agentic ns 已有 langfuse）。

---

## 8. 凭据模型（全链路）

```
Vaultwarden（真源，人管理）
  └─► K8s Secret（core-api/flowmind-api-env · flowmind-mcp-env · core-ui/flowmind-ui-env 无密钥）
        └─► Pod env ──► lib/cluster 目录解析 ──► 各客户端
开发机：工作区根 .env（RAK_* / PG* / S3* / LITELLM_MASTER_KEY）—— 同一份 key 名，零代码分叉
```

三条铁律：① 前端零密钥（浏览器包内不可出现任何凭据，`NEXT_PUBLIC_*` 白名单只剩端点提示）；② UI 零基础设施配置（设置页不含端点/密钥输入）；③ 泄露即轮换走 Vaultwarden+CREDENTIALS.md 附注命令，改 Secret 后 `kubectl rollout restart`（Keel 不管自家金丝雀）。

---

## 9. 认证与多租户占位（本期明确不做）

- 自用期：UI 裸奔（自带登录占位）+ `/api` 边缘限流 `rak-api-ratelimit`（200rps/IP）。
- 预留不实施：`00013_saas_groundwork` 归属列语义平移至新 `db/migrations`；flowmind-api 的 Hono 中间件链预留 `authContext` 挂点（现返回系统单一 owner）；RLS 策略文件占位不启用。
- 启动条件（终局 SaaS 时）：注册/登录（自建 or authentik 复用评估）、RLS 收紧、按 owner 的 Secret 隔离。

---

## 10. 发布、CI/CD 与验证

### 10.1 流水线（对齐 rak-infra 标准接入流程 A）

```
GitHub VANexus/cross-dashboard (main)
  └─ Actions sync-to-gitlab ─► GitLab core-ui/flowmind-ui（api 拆分后增 core-api/flowmind-api）
       ├─ build: kaniko(harbor/infra/kaniko:debug) → harbor/core-ui/flowmind-ui:{SHA8,latest}
       ├─ validate: kubeconform 校验 deploy/gitops/flowmind-ui/*.yaml
       └─ deploy-gitops: argocd-apps apps/flowmind-ui/rollout.yaml sed SHA → commit
            └─ ArgoCD(auto-sync+selfHeal) → Rollouts canary 25%→60%→100%
                 └─ analysis 门（restarts≤1 + ready，initialDelay 30s ⚠坑#24 必须传 hash 参数）失败自动 abort 回滚
```

坑位对照（已在脚手架中处理）：GOPROXY=goproxy.cn（Go 才需要，本项目 Node/Bun 无此步骤）、`HARBOR_CONFIG_B64` 普通变量 base64（robot 名 `$` 坑）、证书一级子域必须 `xrak-wildcard-tls`（坑#21）、AnalysisTemplate 复用 ns 内既有模板改造、手改集群=漂移（一切走 git）。

### 10.2 资源基线（默认值，上线前确认）

flowmind-ui：2 副本 / 250m-1 CPU / 512Mi-1Gi；flowmind-api：2 副本 / 500m-1CPU / 512Mi-1Gi（内核常驻会话偏内存）；flowmind-mcp：1-2 副本 / 500m-1CPU / 1Gi。

### 10.3 每阶段验收门

| 阶段 | 门 |
|---|---|
| P0（本文随附代码） | `bun run build`+lint 绿；设置页无 MCP/密钥输入框；`/api/cluster/services` 两形态返回正确；E2E b2b/settings 绿 |
| P1 数据层 | §4.3 S2 验收 grep=0；数据 count/md5 校验单；E2E 全绿 |
| P2 分离 | 域切流清单逐项：Traefik 切流→旧 route 删→E2E；SSE 长会话不缓冲；金丝雀演练一次故意坏版本自动回滚 |
| P3 MCP 服务化 | 集群内 `curl flowmind-mcp:8001/api/v1/health`；浏览器经 `/backend-mcp` 完成技能发现；flowmind `.env` 本地文件密钥清零 |
| P4 可观测 | Grafana 有 flowmind 三服务 RED 面板 + Loki 日志检索 + 一条跨服务 trace |

---

## 11. 可观测接入（rak-observability 规范）

- flowmind-api / flowmind-ui(node server)：`@opentelemetry/sdk-node` + auto-instrumentations，dev 关、cluster 开（目录 `obs.otel`）；`service.name` = 部署名，`service.namespace` = core-ui/core-api。
- 日志：结构化 JSON 到 stdout（pino）→ Loki 自动采集；查询 `{app="flowmind-api"} | json | level="error"`。
- flowmind-mcp：Python OTel 按 rak-observability 模板接 `otel-collector…:4317`。
- 业务指标：MCP 断路器状态（`ContentMCPClient.getStats()` 已有）导出为 Prometheus 指标 /metrics，金丝雀 analysis 门即可用 `http_requests` 之外的业务信号。

---

## 12. 迁移 Roadmap（施工顺序）

| 阶段 | 内容 | 依赖 | 回滚面 |
|---|---|---|---|
| **P0 零配置底座（本次）** | `lib/cluster` 目录 + MCP/discovery 接入 + 设置页瘦身 + ai 默认值走目录 + Dockerfile/CI/gitops 脚手架 + 本文 | — | 纯增量，可整体 revert |
| **P1 数据层换血** | §4（S0→S2），删 Supabase 云 | P0（连接解析复用目录） | 迁移脚本幂等；数据回灌可逆 |
| **P2 全栈化改造（已被取代）** | ~~`server/` Hono + 逐域绞杀~~ → 改为 Next.js 全栈 F1–F4（分层落目录 / worker-cron 角色 / 队列化 / 无状态化），见 `2026-09-03-nextjs-fullstack-architecture.md` §8 | 可与 P1 并行 | 按角色/边界回退（同镜像单服务，无跨服务切流） |
| **P3 flowmind 服务化** | §6 清单，上线 flowmind-mcp 金丝雀 | P0（目录已含其端点） | dev 本机模式仍可用作 fallback |
| **P4 可观测 + 打磨** | OTel/pino/面板/告警接线 | P2/P3 | 独立小改动 |

> 顺序理由：P0 先把「极客配置」杀死（用户可感知）；P1 先于 P2 让服务层彻底解耦外部云；P3 可与 P1/P2 并行（不同仓库）。

---

## 13. 风险与对策

| 风险 | 对策 |
|---|---|
| 边缘 `/api` SSE 被压缩/缓冲 | §2.1 middleware 例外 + P2 验收门长会话测试；保底走 `flowmind.api.xrak.top`（API 层流式友好） |
| 27 文件 SQL 改写引入行为差异（PostgREST vs PG） | 逐批 E2E + 数据校验单；`upsert/onConflict`、`count exact` 语义逐一核对，`refresh-gate` 等竞态逻辑用事务收敛 |
| 金丝雀期双副本并存：setInterval 调度重复执行 | P2 调度进 flowmind-api 时统一挂 Redis `SETNX` 租约锁（refresh-gate 已有雏形） |
| MCP 内网服务被 SSRF（经 UI 反代暴露） | `/backend-mcp` 仅转发固定前缀、不接任意 URL；MCPAdapter 只吃目录 browserUrl，删掉「用户输入地址」概念后天然收敛 |
| dev 机 LiteLLM NodePort 未知 | 目录留 `AI_LLM_BASE_URL` env 覆盖；P0 不阻塞（dev 仍可用 ai_config 覆盖跑） |
| selfHeal 反杀手改 | 一切 manifest 进 argocd-apps；本文 deploy/ 为模板源 |

---

附：本文随附 P0 代码改动索引——`lib/cluster/`（目录）、`app/api/cluster/services/route.ts`（脱敏发现端点）、`lib/content/mcp-client.ts` / `lib/discovery/service-registry.ts`（接入目录）、`lib/ai/index.ts`（默认值走目录）、`lib/services/b2b-settings.service.ts` + `app/settings/b2b/page.tsx` + 相关 types/api（瘦身）、`next.config.ts`（standalone）、`deploy/`（Dockerfile/CI/gitops 模板/README）。
