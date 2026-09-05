# CLAUDE.md — Claude Code 开发指南

> 本文件为 Claude Code (claude.ai/code) 提供 cross-dashboard 项目的开发指引。

## 常用命令

| 任务 | 命令 |
|------|------|
| 开发服务器 | `bun run dev` |
| 生产构建 | `bun run build` |
| 启动生产 | `bun run start` |
| 代码检查 | `bun run lint` |
| E2E 测试 | `bun run test:e2e` |
| 单个测试 | `bun run test:e2e -- path/to/test.spec.ts` |
| 列出测试 | `bun run test:e2e:list` |

包管理器是 **Bun**（不是 npm/pnpm/yarn）。没有单元测试，只有 Playwright E2E 测试（`e2e/`）。**`bun run lint` + `bun run build` + 对应 e2e 是唯一自动化门禁。**

## ⚠️ 这不是你熟悉的 Next.js

本项目使用 Next.js 16.2.6，有破坏性变更——API、约定和文件结构可能与你的训练数据不同。编写代码前**必须**阅读 `node_modules/next/dist/docs/` 中的指南。注意弃用通知。

## 项目概述

**FlowMind** — 跨境电商智能编排系统。UI 全部为中文（zh-CN）。

**前端全栈** = **BFF × 前端 Agent 内核 × MCP 客户端**三支柱（Next.js 16，UI 角色/core-ui）；重技能与云密钥下沉后端 `rak-flowmind`（`flowmind-mcp`，内网）。系统通过 Web Agent 对话编排 + 生成式 UI + 记忆/旅程/技能系统，覆盖选品→Listing→生图→发布→监控的全链路自动化。

**决策记录看 `ADR.md`**（20 条速查表）；视觉/动效/状态管理细则看 `DESIGN.md`（唯一裁决）；路线图看 `TODO.md`；权威架构看 `docs/architecture/2026-09-03-*.md`。

## ⚠️ 集群零配置纪律（违规会被 reviewer 打回）

1. 端点解析**唯一**走 `lib/cluster` 服务目录；禁止 `process.env.X ?? "http://…"` 散装默认。
2. UI 禁止基础设施配置输入框（MCP 地址/模型 key/DB 连接串）；只读状态走 `/api/cluster/services`。
3. 凭据不落库（走 K8s Secret → env；业务凭证 `lib/server/vault.ts` 加密后亦不上送浏览器）；前端包零密钥。
4. 浏览器只访问同源 `flowmind.xrak.top`；无 CORS；`/backend-mcp` 反代到内网 flowmind-mcp。
5. UI 层（components/hooks/stores/lib/kernel/lib/ui）**禁止 import `lib/server/**`**（eslint 强制）；跨边界类型放 `lib/shared`。
6. 数据诚实：上游降级必须标注 degraded/warning/cache，**绝不编造数据**；刷新走 `lib/utils/refresh-gate.ts` 闸门。

## 分层架构

```
浏览器（边缘同源）→ 前端全栈（app/api BFF + src/kernel 内核 + lib/mcp 客户端 + lib/server 数据/技能聚合）
                           │ MCP Streamable HTTP（契约冻结：inp 包裹 + SkillResult 信封）
                           ▼
              flowmind-mcp（rak-flowmind，仅内网，重技能 + 云密钥唯一持有者）
```

- **一镜像三角色**：`FLOWMIND_ROLE=web|worker|cron`（`instrumentation.ts` 按角色装配 OTel）。
- **动态生成 M3/M4/M5**：对话内组件 → 动态工作流（`wf_workflow_specs`，保存为团队 SOP）→ 动态页面（`app/p/[slug]`）。
- **导航/旅程注册表驱动**：侧边栏/命令面板/编排中心全部由 `lib/workspaces/registry.ts` 派生；旅程由 `lib/journeys/registry.ts` manifest 驱动。新增空间/旅程 = 加 manifest 文件 + 注册表登记一行，框架零改动。

## 数据流（双路径）

1. **客户端**：组件 → hooks (`hooks/use-*.ts`，基于 `useFetch<T>`，SWR 内核) → `fetch('/api/...')` → API Route → Service → Repository → PG
2. **服务端 (SSR)**：Island 组件 (`islands/*-island.tsx`) → Service → Repository → PG → 作为 props 传递给客户端组件（不过 HTTP、无 envelope）

UI 数据形态：Island(props) 与 API(`{success, data}`) 不同，别在一处用错。

## ⚠️ 核心数据约定

- **Repository 读写 JSON**：数组/嵌套对象存 TEXT 列，写入必须 `JSON.stringify()`，读取用 `parseJsonField()`（`lib/server/repositories/base.ts`）；列表端点统一 `paginatedQuery()` 返回 `{ items, pagination }`。
- **API 响应 envelope**：`lib/server/api-response.ts` 的 `success()` 返回 `{ success: true, data, pagination? }`；失败用 `error()/notFound()/badRequest()/methodNotAllowed()`。
- **状态管理五层**（DESIGN.md §6）：接口数据 → SWR；进链接/刷新保留 → nuqs；跨路由共享 → zustand（细粒度 selector，组件外用 `getState()`）；注入式服务 → Context；其余 → 局部 state。**禁止手写取数三态机、禁止第二套全局状态库、凭据永不进 store。**
- **动效默认 GSAP**（DESIGN.md §4）：`data-animate` 钩子 + `autoAlpha` + `clearProps` + reduced-motion 降级，只动 transform/opacity；framer-motion 仅存量保留。

## 关键目录

| 目录 | 说明 |
|------|------|
| `lib/server/` | 服务端全部能力（**UI 禁止 import**） |
| `lib/server/services/` | 业务服务层（b2b/content/wechat/intel/localize/risk/memory/evolution/task/workflow/dashboard…；纯类按需实例化） |
| `lib/server/repositories/` | 数据访问层，每实体一个 Repository |
| `lib/server/db/` | 数据层：PG（主库）+ Redis + Mongo + Milvus（RAG）；迁移在 `migrations/` |
| `lib/server/mastra/` | Mastra 长流程工作流（listing-pipeline / b2b-daily-trends）+ run-registry（Redis 快照断点续跑） |
| `lib/server/agent-runtime/` | Agent 生命周期（wake→context→think→journal→decide→mood→emit）、brain/reflex、personas |
| `lib/server/ai/` | AI Provider（LiteLLM 网关）+ prompts + prompts-b2b |
| `lib/server/rak/` | RAK 引擎（**0-import 死代码**，仅历史参考） |
| `lib/kernel/` | 前端内核插件：ui-actions（L0/L1/L2）、page-context、component-kit |
| `src/kernel/` | Cordis 微内核：model-adapter / tool-registry / mastra-engine / pi-subagent / spec-store |
| `lib/mcp/` | MCP 客户端 + 服务发现（MCP/A2A/REST 适配器、service-registry、intent-router） |
| `lib/cluster/` | ⚠️ 唯一基础设施端点解析入口 |
| `lib/workspaces/` `lib/journeys/` | 空间/旅程 manifest 注册表 |
| `lib/shared/` | 边界共享类型 |
| `components/ui/` | 原子组件库（零业务，shadcn 规范） |
| `components/agent/` | agent-dock / agent-drawer（dock/sidebar/stage 三面一体）/ agent-orb；`generated/` 动态 UI 渲染器 |
| `stores/` | zustand store（agent-presence、journey-run） |
| `hooks/` | 客户端取数 hooks（统一 `useFetch<T>`） |
| `e2e/` | Playwright E2E（16 个 spec） |

## 页面结构模式

```
app/<section>/
  page.tsx              ← Server Component，导入 island
  <section>-client.tsx  ← "use client" 组件，包含所有 UI 逻辑
  islands/
    <section>-island.tsx ← Server Component，通过 service 获取数据，传递 props 给 client 组件
  loading.tsx           ← Suspense 骨架屏（`.skeleton` 同尺寸，不只转圈）
  error.tsx             ← 错误边界
```

## API 路由模式（BFF 薄壳纪律）

handler 不写业务：只做 参数解析 → 调 service → 格式化。

```typescript
import { withDb } from "@/lib/server/api-helpers";
import { success } from "@/lib/server/api-response";
export const GET = withDb(async (request: NextRequest) => { ... });
```

请求体用 `lib/server/api-validation.ts` 的 `parseBody()`（Zod）验证。

## 业务子系统

- **六大工作流** + 视频本地化（`/workflows/*`）：product-research / ai-imaging / ai-advertising / ai-listing / inventory / competitor-ads / video-localization。
- **B2B 运营主线**（`/b2b/*` + `/content-studio/wechat`）：关键词趋势（TikHub + 快照飙升榜）、长尾词、阿里国际站选品/推荐（RAG）、Listing 五层生成 + TOP 协议直连发布（L2 确认）、生图 Skill 体系、每日简报、微信公众号端到端（走 MCP）。

## 数据库（见迁移 `lib/server/db/migrations/`）

- **PG**（集群主库）：业务域 + `wf_*` 工作流表（含 b2b listings、workflow_specs/page_specs/runs）。
- **Redis**：TTL 会话、跨副本事件、Run 快照（`fm:wf:run:*`，30min）。
- **Mongo**：文档型（evolution 等）；**Milvus**：RAG 向量检索。
- **Supabase 云退役中**（ADR-005）：新代码一律走 `lib/server/db`。

## 组件库 / 样式 / 关键依赖

- `components/ui/`：30+ Radix UI 原子件（shadcn 规范；获取顺序 = 现成件 → `bunx shadcn add` → registry → 才手写）。
- Tailwind CSS v4，无 config，token 唯一真源 `globals.css`（`@theme inline`）；新颜色必须补 `:root` 与 `.dark`。
- 关键依赖：recharts v3、gsap（+`@gsap/react`）、framer-motion（限量）、@xyflow/react、@tiptap、@tanstack/react-table + react-virtual、sonner、cmdk、nuqs、zustand v5、swr、zod v4、react-hook-form、@mastra/core、@zilliz/milvus2-sdk-node、postgres、ioredis、mongodb、three。

## 状态管理 / Hooks 约定

- 全局状态 zustand（`stores/`）；主题 `next-themes`；URL 状态 nuqs；服务端数据 SWR。
- 客户端数据获取统一 `useFetch<T>` + `apiPost` 族，假定 API 返回 `{success, data}`，`!success` 抛错。领域 hook 拼 `URLSearchParams`。
- 写成功后 `mutate` 失效对应 GET 缓存（`revalidateOnFocus: false` 为全局策略，业务侧不得打开）。

## AI 配置

- 模型/生图统一走集群 **LiteLLM 网关**（`lib/cluster` 的 `ai.litellm`）；`ai_config` 只留业务偏好键；provider 凭据 env 优先。
- 内核推理零密钥、零上游直连：推理借 LiteLLM，干活借 MCP。

## Agent 生命系统

- Agent 周期**默认关闭**（ADR-014：`cycleConfig.enabled=false`，防自动 LLM 循环）；LLM 调用只发生在用户显式需要时。
- 6 情绪状态机、4 类日志（thought/decision/observation/reflection）、personas 模板，见 `lib/server/agent-runtime/`。
- 前端互动：agent-dock / agent-drawer（三态由 `stores/agent-presence.ts` 唯一真源驱动，ResizeObserver 联动主内容，ADR-013）。
- 实时流：SSE（`/api/agent/stream` 对话 / `/api/agents/[id]/stream` 生命周期事件）。

## 紫鸟浏览器桥接

爬虫中心通过 `lib/server/ziniao/client.ts` 连接本地紫鸟防关联浏览器（默认 `http://127.0.0.1:9481`）。API Key 通过 `ZCLAW_API_KEY` 环境变量或 `~/.zclaw/config.json` 配置。