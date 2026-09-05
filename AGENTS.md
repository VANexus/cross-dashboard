# AGENTS.md — cross-dashboard 开发指南

> FlowMind 跨境电商智能编排系统 — 开发者须知

## 这是什么

cross-dashboard 是 **FlowMind** 的**前端全栈**项目（Next.js 16 App Router），= **BFF × 前端 Agent 内核 × MCP 客户端**三支柱融合。系统通过 Web Agent 对话编排 + 生成式 UI + 记忆/旅程/技能系统，自动化跨境电商业（选品→Listing→生图→发布→监控）全链路。重技能与云密钥下沉后端 `rak-flowmind`（工件 `flowmind-mcp`）。

**决策记录看 `ADR.md`**（含速查表，改架构前先读）；视觉/动效/状态管理细则看 `DESIGN.md`（唯一裁决）；路线图看 `TODO.md`；权威架构文档在 `docs/architecture/`。

## 关键规则

### ⚠️ 集群零配置纪律（2026-09-03 起，架构真源 `docs/architecture/2026-09-03-cluster-native-service-architecture.md`）

FlowMind 已切换为「集群原生化服务架构」（三次拍板：权威设计 `docs/architecture/2026-09-03-nextjs-fullstack-architecture.md`）：系统 = **前端全栈**（本仓 Next.js 16，**UI 角色/core-ui**，= **BFF × 前端 Agent 内核 × MCP 客户端** 三支柱融合，一镜像三角色 web/worker/cron）＋ **后端 flowmind**（父目录 `rak-flowmind` Python 技能后端 → 集群 `flowmind-mcp`，core-api/仅内网，云密钥唯一持有者）。全自托管于 XRAK 集群。

1. **端点解析唯一入口 = `lib/cluster`**（服务目录）。业务代码禁止再写 `process.env.X ?? "http://…"` 的散装默认值；新增外部依赖 = 目录加一行（cluster svc DNS / dev mesh / env 逃生门三级解析）。
2. **UI 不允许出现基础设施配置输入框**（MCP 地址、模型/生图 key、DB 连接串等一律零填写，状态只读展示走 `/api/cluster/services`）。设置页只放「业务凭证/登录态」。
3. **凭据不落库**：api_key/base_url 等属集群 Secret → env 链路，禁止写入 `ai_config`；前端包内禁止出现任何密钥（`NEXT_PUBLIC_*` 白名单只剩端点提示）。业务凭证（如微信 appSecret）经 `lib/server/vault.ts` 加密落库且绝不上送浏览器。
4. **浏览器只访问同源 `flowmind.xrak.top`**（边缘同源反代；`/api/*` 由本 Next.js 全栈服务自己承载，**没有也不许引入独立后端服务**；`flowmind.api.xrak.top` 只是同一服务的机器流量域；`/backend-mcp` → 内网 flowmind-mcp）；跨域方案被否，勿引入 CORS 配置。
5. **全栈分层方向（F1 已落地）**：UI 层（components/hooks/stores/lib/kernel/lib/ui）**禁止 import** `lib/server/**`（eslint `no-restricted-imports` 强制）；服务端能力（lib/server：services/db/ai/mastra 等）只经 RSC props、`/api/*`、Server Actions 到达 UI；跨边界类型放 `lib/shared`；MCP 协议层在 `lib/mcp`（支柱三）。
6. **数据诚实**：上游能力不足时必须如实标注 degraded/warning/cache（SkillResult 信封），**绝不编造数据**；refresh 走 `lib/utils/refresh-gate.ts` 闸门（防付费 API 被反复打）。
7. 部署/接入/GitOps 操作按 `deploy/README.md` + rak-infra skill 执行，**一切 manifest 走 git（argocd-apps），手改集群会被 selfHeal 反杀**。

### ⚠️ 这不是你熟悉的 Next.js

本项目使用 Next.js 16.2.6，有破坏性变更。编写代码前**必须**阅读 `node_modules/next/dist/docs/` 中的指南。注意弃用通知。

### 包管理器

**必须使用 Bun**（不是 npm/pnpm/yarn）。

```bash
bun install          # 安装依赖
bun run dev          # 开发服务器
bun run build        # 生产构建
bun run test:e2e     # E2E 测试
```

### 无单元测试

本项目**没有单元测试**，只有 Playwright E2E 测试（`e2e/` 目录）。测试配置在 `playwright.config.ts` 中，仅使用 Chromium 浏览器。**`bun run lint` + `bun run build` + 对应 e2e 是唯一自动化门禁。**

### Tailwind CSS v4

**没有 `tailwind.config.*` 文件**。主题在 `globals.css` 中通过 `@theme inline` 块配置，使用 CSS 变量映射。自定义工作流颜色：`text-wf-product`、`bg-wf-imaging` 等。Token 唯一真源 `globals.css`（新增颜色必须同时给 `:root` 与 `.dark`）。

## 架构概览

```
浏览器（边缘同源 · flowmind.xrak.top）
   │
┌──▼────────────────────────────────────────────────────────────┐
│  前端全栈（本仓 Next.js 16 · core-ui）                          │
│                                                               │
│  支柱一 BFF          支柱二 前端Agent内核     支柱三 MCP客户端   │
│  app/api + RSC      src/kernel(cordis) +    lib/mcp +         │
│  + Actions + SWR    lib/kernel(ui-actions/  lib/content       │
│  「为UI供数」          page-context)          「调后端技能」      │
│                      「页面内智能」                            │
│  数据：集群 PG / Redis / Mongo / Milvus（lib/server/db）        │
└──────────────┬───────────────────────────────────────────────┘
               │ MCP Streamable HTTP（/mcp）· 契约冻结
┌──────────────▼───────────────────────────────────────────────┐
│  flowmind-mcp（rak-flowmind · core-api 仅内网）                │
│  重技能 + 云密钥唯一持有者 + 上游供应商对接                      │
└──────────────────────────────────────────────────────────────┘
```

- **一镜像三角色**：`FLOWMIND_ROLE=web|worker|cron`（`instrumentation.ts` 按角色装配 OTel；Agent 自主周期已退役，见 ADR-014）。
- **三层动态生成**：M3 对话内组件 → M4 动态工作流（落 `wf_workflow_specs`，"保存为团队 SOP"）→ M5 动态页面（`app/p/[slug]`）。

### 导航/空间/旅程（注册表驱动）

- **workspaces 注册表** `lib/workspaces/registry.ts`：侧边栏、命令面板、编排中心全部由它派生。新增空间 = `lib/workspaces/manifests/` 加文件 + 注册表登记一行，框架代码零改动。
- **journeys 注册表** `lib/journeys/registry.ts`：旅程 manifest 驱动（步骤带 workspaceId/href/agentHint/handleSelector），新增旅程同理。
- 现有 7 空间：command-deck（工作台）/ insight（市场洞察）/ content-workshop（内容工坊）/ listing-ops（上架运营）/ growth（能力工作台）/ monitor（运行监控）/ system（系统）。

### 数据流（双路径）

1. **客户端**：组件 → hooks (`hooks/use-*.ts`，基于 `useFetch<T>`) → `fetch('/api/...')` → API Route → Service → Repository → PG
2. **服务端 (SSR)**：Server Component → service → Repository → PG → props → Client 组件（island 模式，不过 HTTP、无 envelope）

### 页面结构模式

每个页面遵循以下布局：

```
app/<section>/
  page.tsx              ← Server Component（RSC，导入 island 或自取数）
  <section>-client.tsx  ← "use client" 组件，包含所有 UI 逻辑
  islands/
    <section>-island.tsx ← Server Component，通过 service 获取数据，传递 props
  loading.tsx           ← Suspense 骨架屏
  error.tsx             ← 错误边界
```

### API 路由模式（BFF 薄壳纪律）

```typescript
import { withDb } from "@/lib/server/api-helpers";
import { success } from "@/lib/server/api-response";
export const GET = withDb(async (request: NextRequest) => { … return success(data); });
```

- 请求体验证用 `parseBody()`（Zod，`lib/server/api-validation.ts`），响应用 `success()/error()/notFound()`。
- handler 不写业务：只做 参数解析 → 调 service → 格式化。BFF service 只干三件事：**聚合**、**缓存**、**自有数据读写**。

## 关键目录

| 目录 | 说明 |
|------|------|
| `lib/server/` | 服务端全部能力（UI 禁止 import 这里） |
| `lib/server/services/` | 业务服务层（b2b/content/wechat/intel/localize/risk/memory/evolution/task/workflow/dashboard…） |
| `lib/server/repositories/` | 数据访问层，每个实体一个 Repository（base：`parseJsonField` / `paginatedQuery`） |
| `lib/server/db/` | 数据层：PG（primary）/ Redis / Mongo / Milvus（向量 RAG）/ embeddings / b2b-kb；迁移在 `migrations/`（0001→0005 + types） |
| `lib/server/mastra/` | Mastra 长流程工作流（listing-pipeline、b2b-daily-trends）+ run-registry（Redis 快照断点续跑） |
| `lib/server/agent-runtime/` | Agent 生命周期引擎（wake→context→think→journal→decide→mood→emit）、brain/real-brain/reflex、personas/模板 |
| `lib/server/agent/` | 对话侧服务端能力（chat-context/chat-compact/memory-augment/genui-prompt/capabilities/context-stats） |
| `lib/server/ai/` | AI Provider（LiteLLM 网关）+ prompts.ts + prompts-b2b/（B2B 提示词与生图种子） |
| `lib/server/rak/` | RAK 引擎（**死代码**，0-import，仅历史参考，勿据此新增） |
| `lib/kernel/` | 前端内核插件：ui-actions（L0/L1/L2 风险分级）、page-context（页面快照）、component-kit（动态组件） |
| `lib/agent/` | Agent 客户端侧：agent-bus（UI 被 Agent 编排入口）、genui、page-context、surface-morph |
| `lib/mcp/` | MCP 客户端 + 服务发现层（MCP/A2A/REST 适配器、service-registry、intent-router，ADR-008 契约） |
| `lib/cluster/` | ⚠️ 唯一基础设置端点解析入口（零配置服务目录，ADR-007） |
| `lib/workspaces/` + `lib/journeys/` | 空间与旅程 manifest 注册表（导航/编排中心/旅程唯一来源） |
| `lib/shared/` | 前后端边界共享类型（跨 `lib/server` 与 UI 的类型放这里） |
| `src/kernel/` | Cordis 4.0 后端微内核（model-adapter / tool-registry / mastra-engine / pi-subagent / spec-store） |
| `components/ui/` | 基础组件库（原子件，零业务，shadcn 规范见 DESIGN.md） |
| `components/agent/` | Agent 交互三件套：agent-dock（底部灵动岛）、agent-drawer（dock/sidebar/stage 三面一体）、agent-orb；`generated/` 动态 UI 渲染器 |
| `stores/` | zustand 全局 store（agent-presence、journey-run） |
| `hooks/` | 客户端数据获取 hooks，全部基于 `useFetch<T>`（SWR 内核） |
| `e2e/` | Playwright E2E 测试（16 个 spec） |

## 业务子系统

### 六大工作流（`/workflows/*`）+ 视频本地化

| 工作流 | 路由前缀 | 说明 |
|--------|----------|------|
| 选品工作流 | `/workflows/product-research` | execute, keywords, data-sources, pain-points |
| AI 作图 | `/workflows/ai-imaging` | images, generate, storyboard |
| AI 广告 | `/workflows/ai-advertising` | keywords, analyze, optimize, export |
| AI 上架 | `/workflows/ai-listing` | generate, bullets, categories, infringement, publish |
| 库销比 | `/workflows/inventory` | restock-suggestions, restock-order, generate-suggestions |
| 竞品广告分析 | `/workflows/competitor-ads` | competitors, keywords, positions, analyze |
| 视频本地化 | `/workflows/video-localization` | tasks/batch/health（localize.service + lib/server/vl） |

### B2B 运营（主线，ADR-018）

`/b2b/*`（intel 情报 / keyword-trends 关键词趋势 / listing / image-skills）+ `/content-studio/wechat`（公众号端到端）：关键词趋势（TikHub 多平台 + 快照聚合飙升榜）、长尾词、阿里国际站选品/推荐（RAG）、Listing 五层生成与 TOP 协议直连发布（L2 确认）、生图 Skill 体系、每日简报推送（飞书/企微）、渠道账号管理。入口在 `settings/channels`、`settings/b2b`。

## Agent 系统

- **运行编排**：Web Agent 对话编排（`app/api/agent/chat` SSE 统一入口）+ AgentDrawer 三面一体（dock/sidebar/stage，`stores/agent-presence.ts` 为唯一真源，EDS 见 ADR-013）。
- **自主周期默认关闭**（ADR-014）：`cycleConfig.enabled=false`，LLM 调用只发生在用户需要时。
- **情绪/日志/人格**：6 情绪状态机、4 类日志（thought/decision/observation/reflection）、personas 模板，见 `lib/server/agent-runtime/`。
- **长任务**：Mastra workflow + Redis 快照断点续跑（ADR-015），挂起态跨实例可恢复。

## 数据库（见迁移 `lib/server/db/migrations/`）

- **PG**（集群主库，`postgres` 驱动）：UI 态/业务域全部实体 + `wf_*` 工作流表（含 `wf_b2b_listings`、`wf_workflow_specs`、`wf_page_specs`、`wf_workflow_runs`）。
- **Redis**：会话 TTL、跨副本事件、Run 快照（`fm:wf:run:*`，30min TTL）、租约锁。
- **Mongo**：演进记录等文档型数据（`mongo-stores.ts`）。
- **Milvus**：RAG 向量检索（embeddings + b2b-kb 知识库）。
- **Supabase 云正在退役**（ADR-005）：`supabase/migrations/*` 转普通 DDL，新代码一律走 `lib/server/db`。

约定：Repository 写 JSON 字段必须 `JSON.stringify()`，读用 `parseJsonField()`（base.ts）；列表端点统一 `paginatedQuery()` 返回 `{ items, pagination }`。

## AI 配置

- **模型/生图统一走集群 LiteLLM 网关**（ADR-011）；`ai_config` 只留业务偏好键；provider 凭据 env 优先于 KV。
- **不对齐历史 mock/claude/openai 适配器**：当前 `lib/server/ai/` 走 AI SDK（`sdk-provider.ts`），接 `ai.litellm` 目录。
- 内核推理**零密钥、零上游直连**：推理借 LiteLLM，干活借 MCP。

## 紫鸟浏览器桥接

爬虫中心通过 `lib/server/ziniao/client.ts` 连接本地紫鸟防关联浏览器（默认 `http://127.0.0.1:9481`，API Key 通过 `ZCLAW_API_KEY` 或 `~/.zclaw/config.json`）。支持店铺管理、页面访问/提取/操作、截图、自动化流程。抓取实现 `lib/server/crawlers/`（amazon 等）。

## Git 约定

- 提交信息格式：`<type>: <描述>`（feat/fix/docs/refactor/chore）
- 按逻辑单元频繁提交，不要积累大量变更
- 分支命名：`feat/<描述>`；线性历史，按 topic 分支合入 main

## E2E 测试

Playwright 测试在 `e2e/` 目录（当前 16 个 spec）：agents、dashboard、evolution、memory、navigation、risk、tasks、workflows、rsc-features、b2b、content-studio、journeys、agent-actions、listing-launch-p0、team-sop-m4、video-localization。

运行方式：`bun run test:e2e`（全部）或 `bun run test:e2e -- e2e/agents.spec.ts`（单个文件）。