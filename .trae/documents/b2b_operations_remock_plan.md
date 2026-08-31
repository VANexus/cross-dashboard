# FlowMind toB 跨境电商运营端 — 去 Mock 化 + Supabase 迁移 + 三核心功能真实化改造计划

> Plan 更新时间：2026-08-31
> Plan 版本：v1.1（**数据库层升级为 Supabase PostgreSQL**，替换 sql.js）
> Supabase 项目：`https://xbdznkpdtlysvbcoptyw.supabase.co`（anon / service_role 均已通过接入工具获取）
> 目标：① 数据库从本地 SQLite(sql.js) 整体迁移到云 Supabase(PostgreSQL)；② 彻底去除所有 mock/seed 演示数据；③ 三第一优先级功能（关键词趋势榜单 / AI Listing 一键上架 / AI 生图 Skill 化）端到端真实化；④ 通过 Playwright E2E 全量回归。

---

## 一、Repo 调研结论（现状快照）

### 1.1 项目结构
- **前端 cross-dashboard**：Next.js 16.2.6 + RSC/PPR + TypeScript + **待替换 sql.js(SQLite WASM) → Supabase** + Bun 包管理；通过 `ContentMCPClient` 连接后端 MCP-HTTP Server，默认 `http://127.0.0.1:8001/mcp`。
- **后端 rak-flowmind**：Python ≥3.11 + MCP Server + 多智能体引擎；**确认完全不直接操作数据库**（全项目 grep 「sqlite/sql.js/getDb」= 0 匹配），所有数据读写 100% 走前端 Repository 层 → **数据库迁移只需改前端，Python 零改动**。
- **测试**：Playwright E2E 89/89 已通过；`bun run test:e2e` 自动启 `bun run dev` 端口 3000。

### 1.2 Supabase 项目已就位
- Project URL：`https://xbdznkpdtlysvbcoptyw.supabase.co`
- 鉴权：`anon_key`（前端用，RLS 会约束）+ `service_role_key`（后端/敏感操作可选，一般前端 `anon` + Row Level Security 就够）
- 特性：PostgreSQL 16+、Row Level Security(RLS)、pg_net(HTTP 调用)、pg_cron(每日调度) → **可替代 Python 端 APScheduler 每日定时刷新 + 推送（可选方案 C，见 §3.2.4）**

### 1.3 已确认的 mock/seed 分布（全部待清理）
| 位置 | 类型 | 说明 |
|------|------|------|
| `cross-dashboard/lib/db/seed.ts` | 前端 SQLite seed | 13 个 seed*()：Agent 人格、6 大工作流种子词、库存 12 SKU、竞品、B 端趋势词/长尾词/商品池/Listing 草稿、生图 Skill；及 `db/index.ts` 内嵌 `wf_localize_tasks demo`、`wf_content_hot_topics seed`、`wf_content_rules 12 条规则、wf_image_skills 3 条模板、wf_keyword_trends 4 条兜底 |
| `rak-flowmind/config.py:KeywordTrendConfig.seed_keywords` | 后端静态 seed | tiktok 4 词、instagram 3 词、alibaba 3 词 |
| `_trend_adapters.py:SeedTrendAdapter` | 后端降级 seed | 无 TiKHub key 或 instagram/alibaba 无 adapter 时返回假趋势词 |
| `marketing_image_gen.py:MockBackend` | 后端生图 mock | 无 ALLIN_API_KEY 时返回占位假图（本地纯色图） |
| `b2b.service.ts:L39-43 / L121-125` | 前端 cache-first | `fetchKeywordTrends/fetchProducts` 不调 MCP 直接读历史缓存 |

### 1.4 已确认的真实 API 接线（保留 & 缺口）
| 功能 | 真源 | 状态 |
|------|------|------|
| TikTok 关键词趋势 | TiKHub API (`TIKHUB_API_KEY`) | ✔️ 已接 `TiKHubTikTokAdapter` |
| Instagram 关键词趋势 | — | ❌ 无真实 adapter，走 Seed |
| 阿里国际站后台趋势 | — | ❌ 无真实 adapter，走 Seed |
| 长尾词生成 | LongCat-2.0 云 LLM (`LONGCAT_API_KEY`) | ✔️ 缺 key 报错，不返回假 |
| 商品池拉取 | 阿里 TOP `alibaba.product.list` | ✔️ 已接，未授权时返回 degraded + 提示 |
| TOP5 商品推荐 | LongCat-2.0 云 LLM | ✔️ reasons 已要求引用具体热词 |
| Listing 生成 | LongCat-2.0 + 阿里 `listing_rules` | ✔️ 已接，但 rules 只有 4 条默认，待运营补齐 |
| 一键上传国际站 | 阿里 TOP `alibaba.icbu.open.product.post` | ✔️ 已接 + upload_image() |
| 反推 prompt | 视觉云 LLM (`LONGCAT_API_KEY`) | ✔️ 已接 |
| 生图后端 | AllIn-API `gpt-image-2` (`ALLIN_API_KEY`) | ✔️ 有 key 时真，没 key 时 mock（要禁用） |
| 飞书推送 | — | ❌ 有 KB 能力（`feishu_kb.py`），但无机器人 webhook 推送 skill |
| 企业微信推送 | — | ❌ 无 |
| 每日定时刷新 | — | ❌ 无；迁移 Supabase 后可用 **pg_cron** 替代 APScheduler（推荐） |

### 1.5 数据库 Schema（迁移到 PostgreSQL，语法要转写）
> 原 SQLite schema 见 `lib/db/schema.ts` + `db/index.ts` 内联 `CREATE TABLE IF NOT EXISTS`，共约 55+ 张表；迁移到 Supabase 时需要翻译为 Postgres 语法：
> - `datetime('now')` → `now()` / `CURRENT_TIMESTAMP`
> - `INSERT OR IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`
> - `rowid` → 必须加显式主键 `id SERIAL/BIGSERIAL PRIMARY KEY` 或沿用现有 `id TEXT PK`
> - `PRAGMA foreign_keys = ON` → Postgres 默认开，无需
> - `TEXT` 类型可直接复用；JSON 字段 → `JSONB`（parseJsonField 可直接读）
>
> **核心 B 端 5 张表（不变，只改 SQL 方言）**：
> - `wf_keyword_trends` — 趋势词（PK:id TEXT）
> - `wf_longtail_keywords` — 长尾词（PK:id TEXT）
> - `wf_b2b_products` — 商品池（PK:id TEXT，加 UNIQUE product_id）
> - `wf_b2b_listings` — Listing 草稿（PK:id TEXT）
> - `wf_image_skills` — 生图 Skill（PK:id TEXT，新增 `is_builtin BOOL DEFAULT false`、`template_type TEXT` 两列用于运营模板）

---

## 二、需要编辑的文件 & 模块清单

### 2.1 数据库迁移层（Supabase 替换 sql.js）—— 最高优先级 P0
| 文件/路径 | 改动内容 | 优先级 |
|---------|---------|--------|
| `package.json` | ① 删除 `sql.js` 依赖；② 新增 `@supabase/supabase-js` | P0 |
| `cross-dashboard/supabase/migrations/00001_init_schema.sql`（**新建**） | 完整 55+ 张表的 Postgres 版建表 SQL（从 schema.ts + db/index.ts 翻译）；不含任何 seed INSERT；幂等 `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` | P0 |
| `cross-dashboard/supabase/migrations/00002_rls_policies.sql`（**新建**） | 每张业务表面向 `anon` 角色的 RLS Policy：全部 `enable row level security` + `policy anon_all (true)` 宽松，后续可收紧；B 端/Agent/工作流等所有表给增删改查权 | P0 |
| `cross-dashboard/supabase/migrations/00003_b2b_newcols.sql`（**新建**） | 给 `wf_image_skills` 加 `is_builtin BOOL DEFAULT false`、`template_type TEXT DEFAULT ''`；给各表加 `updated_at TIMESTAMPTZ DEFAULT now()` 并触发自动更新触发器 | P0 |
| `cross-dashboard/supabase/seed.sql`（**新建**，但为空 | 留空文件，禁止任何演示 seed INSERT；仅保留一句 `SELECT 1;` 占位 | P0 |
| `lib/db/index.ts`（**整体重写**） | ① 删除 `initSqlJs / WASM_PATH / DB_PATH / saveToDisk / closeDb` 等 sql.js 全部代码；② 改为导出 `getSupabase()` 单例 + `getDbAsync()`/`getDb()` 保留名字但内部调用 Supabase（向后兼容）；③ 删除所有内联迁移（移到 `supabase/migrations`）；④ 删除所有 `if (count === 0) seed*` 和 demo 数据；⑤ `syncAIConfigFromEnv` 保留，改为 Supabase upsert；⑥ agentRuntime 启动保留 | P0 |
| `lib/db/compat.ts`（**整体重写**） | 不再包 sql.js；改为包 `SupabaseClient` 提供同样的 `query(sql).get()/all()` / `run(sql, params)` / `prepare(sql).run()` / `exec(sql)` API —— 通过 `supabase.rpc('exec_sql', ...)` 或直接用 `@supabase/supabase-js` 的 SQL 兼容层；或**更简单：直接废弃 compat.ts，让 Repository 层改写用 Supabase query builder**（二选一读 §3.0） | P0 |
| `lib/db/schema.ts` | 删除 `SCHEMA_SQL` 字符串常量，或仅保留类型注释；不再建表 | P0 |
| `lib/db/seed.ts` | 整个文件保留或删除都可 —— 只要 **db/index.ts 不再调用 seedDatabase()**；若保留：所有 seed*() 函数体清空 | P0 |
| `lib/repositories/*.ts`（共 13 个文件：agent / b2b / content / evolution / journal / localize / memory / rak / risk / task / workflow / base / index） | 两方案二选一：**A（小改动）继续写 SQL + compat 层**，Repository 语法几乎不变；**B（干净）全部改为 Supabase query builder**：`db.query(SQL).all(params)` → `supabase.from(table).select('*').eq(col, val)`，彻底去 SQL 字符串拼接。**默认选方案 A，兼容改动最小，后续再迭代** | P0 |
| `cross-dashboard/.env.example` | ① 删除 `RAK_DB_PATH`；② 新增 `NEXT_PUBLIC_SUPABASE_URL=https://xbdznkpdtlysvbcoptyw.supabase.co`；③ 新增 `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...` | P0 |
| `cross-dashboard/.env.local` (gitignore) | 填入实际 key；CI 用环境变量注入 | P0 |

### 2.2 前端（cross-dashboard 其余部分，和 v1.0 一致，但要适配 Supabase 后的空态）
| 文件/路径 | 改动内容 | 优先级 |
|---------|---------|--------|
| `lib/services/b2b.service.ts` | ① 去掉 cache-first 逻辑，改为「MCP 优先 + TTL 缓存」；② degraded=seed 类来源清缓存；③ 加空态引导统一渲染契约；④ Repository API 不变（因 compat 层保持兼容） | P0 |
| `app/b2b/keyword-trends/**/*` | ① 加「未配置 API key / 无数据」空态 + 配置引导 CTA；② 手动刷新 + 每日更新 badge；③ 推送目标（飞书/企微）配置；④ 数据从 Supabase 读（Repository API 不变） | P1 |
| `app/b2b/listing/**/*` | ① TOP5 推荐绑定热词推荐理由 UI；② 3 偏好切换（发社媒/发阿里/综合）；③ 字段规则校验提示（超长/非法符号）；④ 上传引导授权 CTA；⑤ 空态引导 | P1 |
| `app/b2b/image-skills/**/*` | ① 上传 ROI 好图 → 反推 → 固化 Skill 的完整 UI 流程；② 模板库管理 UI（`is_builtin` / `template_type`）；③ 空态引导上传 | P1 |
| `app/settings/page.tsx` 或 `app/settings/b2b/page.tsx` | 新增配置页：TIKHUB / ALIBABA_* / LONGCAT / ALLIN / 飞书 webhook / 企微 webhook；保存到 `ai_config` Supabase 表 | P0 |
| `e2e/b2b.spec.ts` | 重写 14 条：seed 硬值断言 → 改为「空态引导 → 配置模拟 → 结构断言」 | P2 |
| `e2e/navigation.spec.ts`, `e2e/dashboard.spec.ts` 等 10+ 规格 | grep 所有对演示数据的硬断言 → 改空态或结构存在性 | P2 |

### 2.3 后端（rak-flowmind）—— 和 v1.0 一致，数据库层零改动
| 文件/路径 | 改动内容 | 优先级 |
|---------|---------|--------|
| `config.py` | ① 删除 `KeywordTrendConfig.seed_keywords`；② `AlibabaConfig.listing_rules` 从 4 条默认 → 扩展为运营可配置（读 env 或 yaml）；③ 新增飞书/企微 webhook config | P0 |
| `skills/_trend_adapters.py` | ① `SeedTrendAdapter.get_trends()` raise NotImplementedError；② 新增 InstagramTrendAdapter；③ 新增 AlibabaBackendTrendAdapter；④ `resolve_adapter` 抛错不降级 | P0 |
| `skills/b2b_keyword_trends.py` | ① 去掉 degraded=seed 兜底；② 未配置 → 返回结构化 unauthorized/warning | P0 |
| `skills/marketing_image_gen.py` | ① 删除 MockBackend 兜底 → 无 ALLIN_API_KEY 时抛出结构化错误；② 加 skill_id 参数叠加固化 prompt | P0 |
| `skills/alibaba_listing_generate.py` | ① 扩展 `listing_rules` 读完整运营字段规则；② 偏好参数 social/alibaba/mix；③ 校验标题长度/特殊符号并返回 warnings | P1 |
| `skills/alibaba_product_recommend.py` | ① 3 偏好权重；② reasons 格式校验（引用热词热度/涨幅） | P1 |
| **新增** `skills/b2b_push_feishu.py` | 飞书机器人 webhook 推送关键词趋势摘要 | P1 |
| **新增** `skills/b2b_push_wecom.py` | 企业微信群机器人 webhook 推送 | P1 |
| **新增** `skills/b2b_daily_refresh.py` **或用 Supabase pg_cron** | 方案 A（Python APScheduler）/ 方案 C（Supabase pg_cron + pg_net HTTP 调 MCP refresh endpoint）二选一；**推荐 C（省一个 scheduler 进程）** | P1 |
| `server.py`（MCP server 入口） | 注册以上新增 skill | P0 |

### 2.4 配置 & 环境
| 文件 | 改动 | 优先级 |
|------|------|--------|
| `cross-dashboard/.env.example` | 补全 SUPABASE_* / TIKHUB / ALIBABA_* / LONGCAT / ALLIN / FEISHU_WEBHOOK / WECOM_WEBHOOK | P0 |
| `rak-flowmind/.env.example` | 补全 TIKHUB / ALIBABA_* / LONGCAT / ALLIN / FEISHU_WEBHOOK / WECOM_WEBHOOK | P0 |

---

## 三、分阶段修改步骤

### 阶段 0：运营配合项确认（并行不阻塞编码，但阻塞 UAT）
- [ ] **运营七七**：① 生图 ROI 模板库（图片 + 期望风格名 + 可选备注 + 模板类型：主图/详情/社媒）
- [ ] **运营张恒**：② 国际站上架全部字段规则（字段名/最长字数/特殊符号白名单/必填项/爆款潜规则清单）
> 注：阶段 0 不阻塞代码落地——代码先落可配置接口，默认占位规则先占位，运营补录后覆盖即可。

---

### 阶段 0.5：数据库迁移 sql.js → Supabase（P0 — 先做，为所有后续改造打地基）
> **目标**：完全删 sql.js 依赖，所有 Repository 读写 Supabase Postgres，整个项目能跑起来 89 个 E2E 不因 DB 层挂掉。
>
> **Repository API 兼容策略（默认方案 A）**：保留 `lib/db/compat.ts`，但内部包 SupabaseClient 并提供一模一样的 `query(sql).get()/all()` / `run(sql, params)` / `prepare(sql).run()` / `exec(sql)` 五个方法。实现方式：用 Supabase 的 `rpc("exec_sql", {sql, params})`（需要先在 Supabase 里建一个 SECURITY DEFINER 的 SQL 函数 `exec_sql`，参数化执行，仅限 service_role 调；或方案 A2：前端 query builder 直接模拟 compat，不写原生 SQL —— 推荐 A2 更安全，避免前端拼 SQL）
>
> **建议选简化版（推荐）方案 A2**：`compat.ts` 五个方法内部用 `supabase.from().select().eq().range()` / `.insert().select()` / `.update()` / `.delete()` 把 SQL 字符串解析成语义化调用；简单 SQL（单表 CRUD + WHERE 等值 + ORDER BY + LIMIT）100% 覆盖；复杂 JOIN SQL（若有）单独改写。

#### Step 0.5.1 建 Supabase Schema 迁移 & RLS
- 新建 `cross-dashboard/supabase/migrations/00001_init_schema.sql`：
  - 把 `lib/db/schema.ts` 的 SCHEMA_SQL + `db/index.ts` 中所有 `exec(CREATE TABLE IF NOT EXISTS ...)` 逐段翻译成 Postgres 语法
  - 55+ 张表全部：`id TEXT PRIMARY KEY`（沿用现有，避免 rowid）；`TIMESTAMPTZ DEFAULT now()` 替代 `TEXT DEFAULT (datetime('now'))`；`JSONB` 替代存 json 的 TEXT 字段（可选，或继续 TEXT 以省 parseJsonField 改动）
  - 所有 `CREATE INDEX IF NOT EXISTS idx_*` 同步翻译
  - **禁止任何 INSERT/UPDATE seed**
- 新建 `00002_rls_policies.sql`：每张表 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY; CREATE POLICY anon_all ON ... FOR ALL USING (true) WITH CHECK (true);` 先全开，后续生产环境收紧
- 新建 `00003_b2b_newcols.sql`：`ALTER TABLE wf_image_skills ADD COLUMN IF NOT EXISTS is_builtin BOOL DEFAULT false; ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT '';`；加通用 `updated_at` 触发器函数
- **执行迁移**：`supabase db push` 或用 `supabase_apply_migration` 工具（Trae 里已集成 `supabase_apply_migration`，直接推）

#### Step 0.5.2 前端 DB 层重写
- 编辑 `package.json`：`bun remove sql.js; bun add @supabase/supabase-js`
- 重写 `lib/db/index.ts`：
  - 顶部：`import { createClient } from '@supabase/supabase-js'`；单例 `let _supabase: SupabaseClient | null`；`getSupabase()` 读 env `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` 创建 client
  - 删除 `initSqlJs / WASM_PATH / DB_PATH / writeFileSync(readFileSync)/saveToDisk / closeDb / export`
  - `getDbAsync()` 依然返回 Promise 但直接 resolve getSupabase() wrapped；`getDb()` 返回 compat 层实例；`isDbReady()` 改为检查 `_supabase !== null`
  - 所有内联 `exec(CREATE TABLE)` 迁移代码 **整段删除**（已在 Supabase migrations 里）；所有 `if (count === 0) seed*` 全部删除，包括 wf_localize_tasks demo、wf_content_rules、wf_content_hot_topics、wf_image_skills 3 条模板、wf_keyword_trends 4 条兜底
  - `syncAIConfigFromEnv` 保留：改为 `supabase.from('ai_config').upsert({...}).select()`
  - `agentRuntime.start()` 保留
- 重写 `lib/db/compat.ts`（**方案 A2：Semantic compat — 不执行原生 SQL，把常见 SQL 模式翻译为 supabase query builder**）：
  - `query(sql: string).get(...params)`：解析出 `SELECT cols FROM table WHERE col=? ORDER BY ? LIMIT 1` 这类模式，映射为 `supabase.from(table).select(cols).eq(...).maybeSingle()`；解析失败抛错「请改写为 Supabase query builder」——把 parseJsonField 返回字段兼容
  - `query(sql).all(...)`：同上但 `.select().eq().order().range(0,N)`
  - `run(sql, params)`：识别 INSERT/UPDATE/DELETE → `supabase.from().insert()/update()/delete()`，返回 `{ changes }`
  - `prepare(sql).run(...)`：调用 run(sql, params)
  - `exec(sql)`：仅接受 `PRAGMA`（忽略）和 `SELECT 1`（返回空）；其他抛错「use migrations」
- `lib/db/schema.ts`：清空 SCHEMA_SQL，仅导出类型（或保留注释）
- `lib/db/seed.ts`：要么整个文件删掉；要么每个 seed 函数体变空；**db/index.ts 确保不再引用 seedDatabase**

#### Step 0.5.3 Repository 层适配
- 逐个文件打开 13 个 Repository：
  - 运行期调用 compat 层；若 SQL 能被 Step 0.5.2 的解析器覆盖 → **零改动**
  - 解析失败（多表 JOIN / 复杂 WHERE）→ 手工改写该函数，用 Supabase query builder 原生 API
  - `lib/repositories/base.ts` 的 `paginatedQuery()`：SQL 简单（单表 + COUNT + LIMIT OFFSET）→ compat 层解析即可；或改写为两次调用 `supabase.from(table).select(..., { count: 'exact' }).eq(...).range(offset, offset+pageSize-1)`
- 所有 Repository 从 `getDb()` 获取 compat client → 接口不变

#### Step 0.5.4 迁移验证 & E2E 基线
- 启 dev：`bun run dev` → 访问所有 20 个侧边栏页面 → **肉眼确认全部空态 + 不崩溃**
- `bun run test:e2e` → 预期：绝大多数用例因「找不到之前硬编码的 seed 演示值」而失败；**页面不崩溃 / 能路由 / 200 OK** 为通过基线

> 阶段 0.5 完成标志：**sql.js 从 package.json 彻底移除；所有数据读写 Supabase；页面全部能空态渲染无崩溃**。

---

### 阶段 1：去 Mock 化（P0 — 跑通全栈「无数据 + 配置引导」）
#### Step 1.1 后端 seed 清理 + 禁止降级
- 编辑 `rak-flowmind/config.py`：删除 `KeywordTrendConfig.seed_keywords` 整段静态 dict
- 编辑 `skills/_trend_adapters.py`：
  - `SeedTrendAdapter.get_trends()` raise `NotImplementedError("No real trend adapter for platform {platform}")`
  - `resolve_adapter(platform)` 找不到时直接抛错，不 fallback 到 SeedTrendAdapter
- 编辑 `skills/marketing_image_gen.py`：
  - 无 ALLIN_API_KEY 时抛出结构化错误：`SkillResultEnvelope(ok=False, error="生图失败：未配置 ALLIN_API_KEY", degraded=False, failure_category="config_missing", retriable=False)`，绝不返回假图
- 编辑 `skills/b2b_keyword_trends.py`：
  - 去掉 degraded 兜底 seed 返回，改为 `degraded=False + failure_category="config_missing"`（结构与 `alibaba_product_list` L57-68 一致）

#### Step 1.2 B2BService cache-first → 优先真源 + TTL
编辑 `lib/services/b2b.service.ts`：
- `fetchKeywordTrends(input)`：
  - 删除 `if (!input.refresh && cached.length > 0) return { data: cached, source: "cache" }` fast-path
  - 改为：**优先调 MCP `b2b_keyword_trends`**；MCP 成功 → 清旧缓存 → 写新缓存 → 返回；MCP 失败且 `failure_category=="config_missing"` → **清 Supabase 缓存** → 返回 `{ data: [], degraded: true, warning: "请在设置页配置 API Key", unauthorized: true }`；MCP 其他失败（超时/限流）→ 读 Supabase 缓存并标注 `degraded="cache_stale", ttl=3600`
- `fetchProducts()`：同逻辑，调 `alibaba_product_list`，未授权清缓存并 `unauthorized:true`
- `safePersistKeywordTrends()` / `safePersistProducts()` 等：`degraded=true && source=="seed"` → **拒绝入库**

#### Step 1.3 Settings 配置页
- 新建或扩展 `app/settings/b2b/page.tsx`（RSC Island + Client Form）：
  - 分组卡片：趋势 API（TIKHUB_API_KEY）、阿里国际站（APP_KEY / APP_SECRET / SESSION）、LLM（LONGCAT_API_KEY）、生图（ALLIN_API_KEY）、推送（飞书 webhook URL / 企微 webhook URL）
  - 每个输入：说明文字 + 「测试连接」按钮（调一个 MCP ping 技能）+ 保存（`supabase.from('ai_config').upsert({key, value})`）
  - 顶部加「Supabase 已连接」状态条（`SELECT 1` 健康检查）
- `.env.example` 前后端补变量名与说明

> 阶段 1 完成标志：**启 dev → 访问 B 端三页面 → 看不到任何演示假数据，全部显示「请先在 设置 > B 端配置 填入密钥」空态 + 跳转 CTA → Settings 能保存到 Supabase `ai_config` 表**。

---

### 阶段 2：功能① 行业关键词趋势榜单真实化（P1）
#### Step 2.1 Instagram 趋势 Adapter 实现
- 在 `_trend_adapters.py` 新增 `InstagramTrendAdapter`：
  - **方案 A（推荐，复用 TiKHub vendor）**：TiKHub 已支持 Instagram hashtag/reel 趋势；复用 `TIKHUB_API_KEY`；endpoint 查 TiKHub docs 的 `/instagram/*_trending`
  - **方案 B**：其他第三方 API；需调研供应商；**实施前与用户确认选型**
- `resolve_adapter("instagram")` → InstagramTrendAdapter

#### Step 2.2 阿里国际站后台趋势 Adapter 实现
- 新增 `AlibabaBackendTrendAdapter`：
  - **方案 A（首选）**：TOP 协议 `alibaba.analysis.seller.keyword.rank.get` / `alibaba.analytics.shop.overview.get` 等分析接口（查阿里 TOP docs 确认权限）
  - **方案 B（兜底）**：若阿里未开放分析接口 → 与用户二选一：① 接入第三方关键词工具（卖家精灵/海鹰等）；② 简化为基于 `alibaba.product.list` 热销词统计（词频 + 产品销量加权）
- `resolve_adapter("alibaba")` → AlibabaBackendTrendAdapter

#### Step 2.3 长尾词榜单空输入保护
- `skills/b2b_longtail_keywords.py`：当 `trends` 输入为空数组时 → 返回 `{ ok: true, data: [], warning: "请先刷新趋势词" }`，不要喂空字符串给 LLM

#### Step 2.4 每日更新机制（推荐 Supabase pg_cron 方案 C，替代 Python APScheduler）
三选一：
- **方案 C（**推荐，最轻运维**）**：Supabase `pg_cron` extension + `pg_net` HTTP：
  - 在 Supabase migration `00004_daily_job.sql` 写 `SELECT cron.schedule('daily-b2b-refresh', '0 8 * * *', $$ SELECT net.http_post(url := 'https://<前端域名>/api/b2b/daily-refresh', body := '{}'::jsonb); $$);`
  - 前端新增 `app/api/b2b/daily-refresh/route.ts`：验证请求来自 Supabase（service_role key 鉴权）→ 依次调 MCP `b2b_keyword_trends` 三平台 + `b2b_longtail_keywords` + 推送
- **方案 A（次选，Python APScheduler）**：`rak-flowmind/src/flowmind/scheduler/daily_jobs.py` + server 启动时起 scheduler
- **方案 B（前端 cron hook）**：不推荐（用户不开浏览器不跑）
- 前端关键词趋势页 UI：加「上次更新时间 fetched_at badge + 距离下次更新倒计时 + 手动刷新按钮」

#### Step 2.5 推送到飞书 / 企微
- 新增 `skills/b2b_push_feishu.py`：
  - 入参：`trends_summary`（三平台 TOP10 + 长尾词 TOP10 + 推荐上架 TOP5）
  - 走 `FEISHU_WEBHOOK_URL` 自定义机器人 webhook，发交互式卡片（标题 / 趋势 markdown 表格 / 跳转 B 端页面链接）
- 新增 `skills/b2b_push_wecom.py`：`WECOM_WEBHOOK_URL` 企业微信群机器人 markdown 消息
- 关键词趋势页：两个开关「每日推送飞书」「每日推送企微」+「测试推送」按钮（保存到 `ai_config`）
- 每日 job 里按开关状态调用推送 skill

> 阶段 2 完成标志：**填入 TIKHUB + Instagram 方案 + ALIBABA 权限齐全 → 手动刷新 → 三平台趋势真实有数据 → 长尾词真实生成 → 推送测试成功 → 次日 8:00 自动刷新 + 推送**。

---

### 阶段 3：功能② 货品一键上架（AI Listing）真实化（P1）
#### Step 3.1 TOP5 推荐 + 推荐理由
- `skills/alibaba_product_recommend.py`：
  - 加 `preference: "social" | "alibaba" | "mix"` 参数
  - 权重：social 优先 → 社媒热词权重 ×2；alibaba 优先 → 平台内搜索热词权重 ×2；mix → 等权
  - SYSTEM prompt 里已要求「reasons 引用具体关键词热度做依据」→ 加一层输出 JSON schema 校验：5 条商品 reasons 都引用至少一个 `keyword + heat/delta` 数据（例如「xxx 关键词热度 Top1，日涨幅 +9」）
- 前端 listing 页面：
  - 三个偏好 Tab：「发社媒」「发阿里国际站」「综合」
  - 每张商品卡显示推荐理由（热词 badge + 热度/涨幅高亮）

#### Step 3.2 Listing 生成规则对齐运营要求
- **运营张恒②到位后**，把完整规则写入 `AlibabaConfig.listing_rules`（或 `rak-flowmind/configs/listing_rules.yaml`）：
  - 每条规则包含：`field_name / max_length / special_symbol_whitelist / required / hot_rule (爆款潜规则)`
- `skills/alibaba_listing_generate.py`：
  - `_SYSTEM` prompt 注入完整 rules
  - 生成后执行**校验器**：标题长度截断、特殊符号正则清洗 → 返回 `warnings: [{field, rule_id, message}]` 数组
  - 加 `preference` 参数：发社媒 → 标题抓眼球 emoji 风格；发阿里 → 合规 SEO 关键词堆叠风格；综合 → 平衡
- 前端 listing 页：
  - warnings 黄条逐条提示违反规则
  - 每个字段 placeholder 标注「最长 X 字 / 允许 Y 符号」

#### Step 3.3 一键上传国际站字段映射完整性
- `skills/alibaba_product_post.py`：
  - 对照运营字段清单：确认所有必传字段都从 listing 结果映射到 `alibaba.icbu.open.product.post` payload；缺字段补默认值 + `error="缺少 {field}，请运营检查规则文件"`
  - 主图先走 `_alibaba_client.upload_image()` 拿 URL，再提交到接口
- 前端：授权状态徽章（灰/绿/红）+ 未授权跳转授权文档链接 + 上传成功/失败详细展示（含阿里返回的 product_id / 错误码）

> 阶段 3 完成标志：**产品池真实拉取 → 选偏好 → TOP5 推荐带真实热词理由 → Listing 生成符合运营字段规则并有 warnings → 一键上传返回真实成功或真实失败原因**。

---

### 阶段 4：功能③ AI 生图 Skill 化真实化（P1）
#### Step 4.1 上传 → 反推 → 固化 Skill 的完整前端流程
- 编辑 `app/b2b/image-skills/**/*`：
  - 空态：大按钮「上传 ROI 好图固化为 Skill」→ FileUpload 组件（<5MB，jpg/png/webp） → 预览缩略图 → 调 `B2BService.reversePrompt(file)` → 显示反推结果 `{prompt, style_tags, negative_prompt, aspect_ratio}` 可编辑 → 用户输入 Skill 名 + 选模板类型（主图/详情/社媒） → 调 `B2BService.createImageSkill(...)` → 写入 Supabase `wf_image_skills`（cover_url 存上传图 URL，或反推时直接保存 Object Storage）
  - Skill 库列表：Grid 展示卡片（缩略图 / 风格标签 chip / 使用次数 / 是否内置角标）→ 编辑 / 删除 / 一键生图按钮
  - Supabase **Object Storage**：上传的封面图存 `image-skills` bucket（新建），公开或签名 URL

#### Step 4.2 运营模板库预置
- 运营七七①到位后：
  - 批处理走 `image_prompt_reverse` 反推 → 固化为**内置 Skill**（`is_builtin=true`，`template_type` 标记）
  - 方式：在 Supabase `supabase/seed.sql`（原本空）**仅允许这一次运营值批量 INSERT**；或前端 Settings 里提供「导入模板 zip」（运营自助）
  - 内置 Skill UI 角标「官方模板」，禁用删除按钮，提供「复制为我的 Skill」
  - 分类筛选：所有 / 主图 / 详情图 / 社媒封面 / 我的 Skill

#### Step 4.3 生图 Skill 调用链 & 禁用 Mock
- `B2BService.generateWithSkill(skill_id, extra_prompt, product_context)`：
  - 从 Supabase 取 skill → 拼 `reversed_prompt + style_tags.join(',') + '[NEG]' + negative_prompt + product_context + extra_prompt` → 调 `marketing_image_gen`
- `marketing_image_gen.py` 已接 `skill_id` 参数；再次确认：无 `ALLIN_API_KEY` 时 **一定 throw `config_missing`，绝不返回占位假图**

> 阶段 4 完成标志：**上传一张封面 → 反推 prompt → 固化 Skill → 在 Skill 库里选中该 Skill → 一键生图 → 返回 AllIn API 真实生成的图片（非纯色占位）**。

---

### 阶段 5：E2E 测试改造（P2）
- `e2e/b2b.spec.ts`（14 条重写）：
  - 用例 1-3：空态检查 → 三页面访问 → 断言显示「请在设置中配置密钥」CTA → 点击跳转 `/settings/b2b`
  - 用例 4-6：degraded 结构 → MCP 不可达（Playwright route abort）→ 断言显示红色配置错误卡片，字段级结构存在
  - 用例 7-12：MCP mock 回真实结构 → 断言 UI 字段渲染 & 热词 badge 结构正确
  - 用例 13-14：生图 Skill 上传流程空态 → 「上传 ROI 好图」按钮存在
- 其余 10+ 规格文件（dashboard / agents / workflows / risk / content-studio / localize / tasks / navigation 等）：
  - Playwright 项目内 grep 所有硬编码的 seed 演示文本（如「skincare routine」「白底商摄」「通勤好物」「lt-demo-001」「R-ABS-01」等）→ 把硬值断言改为「结构存在性」/「空态占位」/「列表长度 ≥0」
- `bun run test:e2e` → 89+ 用例 0 failed

---

### 阶段 6：回归 & 交付
- `bun run test:e2e` 全量 0 failed
- 人工浏览器：
  - 填入真实测试 API key → 全链路端到端跑一遍：刷新三平台趋势 → 长尾词 → 推送到测试群 → TOP5 推荐 → 生成 Listing → （沙箱）一键上传 → 上传封面 → 反推 → 固化 Skill → 用 Skill 生图
- 交付：给用户总结 + 运营配合项进度 + 提供 Supabase SQL 控制台入口链接 + 环境变量清单表

---

## 四、潜在依赖 / 考虑项

1. **Instagram & 阿里后台真实数据源选型**（§3.2.1 & §3.2.2 均为二选一）：实施前与用户确认，是优先复用 TiKHub 做 Instagram、还是另找供应商；阿里后台趋势优先 TOP 接口还是第三方工具/简化版。
2. **运营配合项时间点**：字段规则 & 模板库 UAT 前必须到位；开发期先用占位规则。
3. **阿里国际站 SESSION 获取**：OAuth 授权需要运营主账号操作一次，需要提供授权向导文档。
4. **飞书/企微机器人 webhook 创建**：需要管理员在群里加机器人取 webhook URL。
5. **每日调度方案选择**：推荐方案 C（Supabase pg_cron + pg_net + 前端 /api/b2b/daily-refresh），无需独立 scheduler 进程；若用户强依赖 Python 调度再选 APScheduler。
6. **Supabase RLS 策略**：阶段 0.5 全开（USING true），生产环境需根据用户/租户隔离收紧。
7. **每日推送 & 生图 Token/API 费用**：三平台趋势 + 长尾 + 推送 + 生图，费用需用户知晓并确认额度。
8. **Repository 兼容策略最终确认**：默认方案 A2（compat 语义层 + 少量改写）；若用户希望彻底去 SQL 字符串，可追加一轮改造（非 P0）。

---

## 五、风险处理

| 风险 | 影响 | 处理方案 |
|------|------|---------|
| sql.js→Supabase 迁移时某 SQL 模式 compat 层解析失败 | 页面局部崩溃 | 对应函数单独改写为 Supabase query builder；不阻塞其他功能 |
| Instagram/阿里后台无开放 API | 趋势榜单缺平台 | 与用户确认替代数据源，或先仅 TikTok 并在空态卡片标注「平台接入中」 |
| 运营字段规则/模板库迟迟未到 | UAT 阻塞 | 代码先落可配置 rules.yaml，占位规则先跑 |
| 阿里 SESSION 过期/授权失败 | 一键上传失败 | 前端授权 badge + 错误码对照文档 |
| LLM/生图 API 额度耗尽 | 功能 degraded | ContentMCPClient 已有指数退避 + 错误分类；前端显示「限流请稍后重试」+ 提供申请额度 CTA |
| AI 生成内容不合规 | 违规上架 | 发布前强制人工审核；Listing 页「预览 & 修改后再上传」 |
| 去 mock 后全空，用户误以为功能坏了 | 体验 | 每个功能卡片显示大空态 CTA + 跳转设置页；顶部横幅「首次使用？点此完成初始化向导」|
| Playwright E2E 大面积失败（迁移后） | 回归阻塞 | 阶段 0.5 结束先跑一遍，按错误清单逐条改；每阶段末都跑一遍全量 E2E，不堆积 |
| Supabase 连接/网络问题 | 全功能挂 | `getSupabase()` 健康检查失败时，前端页面统一显示「数据库连接异常，请检查网络/密钥」Red banner + 重试按钮 |
