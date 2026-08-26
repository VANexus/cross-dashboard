# 内容创作中心（Content Studio）设计文档

日期：2026-08-26
状态：已批准
涉及项目：`cross-dashboard`（Next.js 16.2.6 Web 前端）、`rak-flowmind`（Python Skill SDK / MCP 服务）

## 1. 背景与目标

cross-dashboard 原先只服务跨境电商垂直（六大工作流）。本次将其扩展为**多垂直内容工作台**，
重点是小红书 / 微信公众号 / 抖音的内容创作，覆盖五个功能：

1. **思路设计**（idea-design）—— AI 生成选题思路
2. **热点雷达**（hot-topic）—— 抓取外部热点
3. **生成文案**（copywriting）—— 平台化文案生成
4. **平台规则审计**（compliance-audit）—— 规则库 + AI 复核
5. **AI 配图**（image-gen）—— 平台比例视觉生成

同时为已就绪的视频本地化流水线（rak-flowmind `localize_*`）在 cross-dashboard 内落地独立页面
（该页面已在工作区落地，本次修复其 10 处小问题并收尾）。

## 2. 两个项目的关系（关键决策）

**rak-flowmind 是通用 MCP 工具（Skill SDK）**，cross-dashboard 是它的一个 **MCP 客户端**。
所有 AI 逻辑与云密钥全部下沉到 rak-flowmind；cross-dashboard **不持有任何 API key**。

```
浏览器 (cross-dashboard) ──HTTP 自身 API──► Next.js Server (MCP Client) ──Streamable HTTP──► rak-flowmind (MCP Server, 密钥+逻辑)
    无密钥                               @modelcontextprotocol/sdk                     mcp 1.28.1（已锁定）
```

- rak-flowmind：`server.py` 已是 FastMCP v1。新增 `streamable-http` 启动方式（`mcp.run(transport="streamable-http")`）
  与 CLI 入口 `flowmind-mcp-http`（uvicorn）。技能照旧 `@skill` 定义，自动成为 MCP 工具，
  **框架层不改**（守 "新增技能不改框架层" 不变量）。
- cross-dashboard：Next.js 服务端 API route 用官方 `@modelcontextprotocol/sdk` 的
  `Client + StreamableHTTPClientTransport` 调 `content_*` 技能，把结构化结果持久化到本地 SQLite。
- 密钥：`LONGCAT_API_KEY`（Anthropic 兼容，`https://api.longcat.chat/anthropic`，模型 `LongCat-2.0`）、
  生图 key（`https://api.ciyuansky.com/v1/images/generations`，OpenAI 兼容）——只进 `rak-flowmind/.env`（gitignored）。

## 3. rak-flowmind：新增内容技能

复用基建：
- `skills/_llm_translate.py` 的 Anthropic 兼容 `/v1/messages` 客户端 → 抽成通用 `skills/_llm_client.py`（`llm_json()`）
- `skills/_image_backend.py` 的 `AllInApiBackend` 是通用 OpenAI 兼容 `/v1/images/generations` 客户端 →
  以 `api_base="https://api.ciyuansky.com"` 复用
- `config.py` 加 `ContentConfig`（密钥只走 env var 名，绝不进 toml/commit）

新增技能（每个 `@skill`，Pydantic 入参 → `SkillOutput`）：

| 技能 id | 入参要点 | 逻辑 |
|---------|---------|------|
| `content_idea_design` | platform, subject, count | LLM 结构化返回 `{ideas:[{angle,title,reason}]}` |
| `content_copywrite` | platform, subject, angle, tone, keywords | LLM 按平台风格生成 `{title,body,tags[]}` |
| `content_hot_topics` | platform, limit | 外部聚合 API 抓取 + 种子兜底；结构化 degraded |
| `content_audit` | platform, title, body, tags | 规则库确定性扫描 + LLM 复核 `{findings:[{category,severity,message,suggestion}]}` |
| `content_image_gen` | platform, prompt, scenes, count | ciyuansky 生图，按平台比例（xhs 3:4 / wechat 16:9 / douyin 9:16） |

错误契约沿用现有两类：
- `content_hot_topics` 走 **degraded SkillOutput**（`ok=True` + `metrics.degraded=True` + `failure_category`）
- 其余走 **普通 raise**（`ok=False` + `error.code`），`invoke()` 统一套信封

热点源映射（`ContentConfig.hot_topic_endpoints`，可配置）：
- douyin → `/douyin`（真榜）
- wechat → `/toutiao`（代理；公众号无公开热榜）
- xhs → `/weibo`（代理；小红书无公开热榜）
聚合 API 默认 `https://api-hot.imsyy.top`（可自托管 DailyHotApi），环境变量 `HOT_TOPIC_API_BASE`。

## 4. cross-dashboard：前端与持久化

### 数据模型（SQLite，沿用 JSON-as-TEXT 约定）

| 表 | 用途 |
|----|------|
| `wf_content_rules` | 规则库（platform/category/severity/pattern/label/suggestion），种子 ~40 条 |
| `wf_content_hot_topics` | 热点快照（platform/word/heat/delta/url/source/fetched_at） |
| `wf_content_ideas` | 思路设计结果（platform/angle/title/subject） |
| `wf_content_drafts` | 文案草稿（platform/title/body/tags/status/audit_result/audit_passed）——成果库主实体 |
| `wf_generated_images` | **复用** + 迁移加 `platform`/`draft_id` 列 |
| `wf_localize_tasks` | **复用**，成果库的本地化视频条目 |

### 新增文件

```
lib/types.ts                       Content* 类型（ContentPlatform/CopyDraft/HotTopic/IdeaAngle/AuditFinding…）
lib/content/mcp-client.ts          MCP Client 封装（连接 FLOWMIND_MCP_URL，调 content_* 工具）
lib/content/platforms.ts           平台元数据（色/格式/热点源）
lib/repositories/content.repository.ts
lib/services/content.service.ts    ContentService（调技能 + 落库 + bumpWorkflowStatus）
lib/api-validation.ts              Zod schema
hooks/use-content-studio.ts
app/api/content-studio/            platforms|ideas|hot-topics|copywriting|copywriting/[id]|audit|images|works routes
app/content-studio/                page + island + loading + error + client（重写）
e2e/content-studio.spec.ts
```

所有 API route 用 `withDb()` + `success()` envelope + `parseBody()`，沿用六大工作流配方。

### 功能数据流

1. 思路设计：POST `/api/content-studio/ideas` → `content_idea_design` 技能 → 落 `wf_content_ideas` → 渲染
2. 热点雷达：GET `/api/content-studio/hot-topics` → `content_hot_topics` 技能 → 落 `wf_content_hot_topics` → 渲染（标注数据源，降级提示）
3. 生成文案：POST `/api/content-studio/copywriting` → `content_copywrite` 技能 → 落 `wf_content_drafts` → 展示+复制
4. 规则审计：POST `/api/content-studio/audit` → `content_audit` 技能 → 审计结果写回草稿 → 严重度着色
5. AI 配图：POST `/api/content-studio/images` → `content_image_gen` 技能 → 落 `wf_generated_images` → 展示真实图

每个功能成功/失败后 `bumpWorkflowStatus(对应id)`，Dashboard "内容工作台状态" 即时点亮。
MCP 不可达 → 结构化错误返回（`degraded` 语义），前端展示降级提示，绝不静默。

## 5. 视频本地化页修复（已存在，本次收尾）

工作区已完整落地（tsc 通过）。修复探索发现的 10 处问题，重点：
1. `lib/vl/client.ts:149` retry 参数丢失（source_lang 恒 "zh"、enable_tts/remove_subtitles 硬编码）→ 从本地行透传
2. 时区解析 `+ "Z"` 假设 UTC → 对 VL naive 本地时间正确解析
3. `batchSizeWarning` 假"自动分批"提示 → 修正
4. job_ids→path 映射、死代码、冗余 Suspense、download 参数校验、e2e 结构化失败断言

## 6. 测试

- rak-flowmind：Layer 1（pytest）+ Layer 2（flowmind-test-skill）+ `ruff check`，全绿
- cross-dashboard：`bunx tsc --noEmit` 零错误、`bun run lint`、新增 `e2e/content-studio.spec.ts`、
  修 `e2e/video-localization.spec.ts`

## 7. 密钥与安全

- 云密钥只进 `rak-flowmind/.env`（gitignored），经 `_secrets.get_api_key()` / env var 读取
- cross-dashboard 零密钥；MCP 工具名与 URL 从 env 读取（`FLOWMIND_MCP_URL`，默认 `http://localhost:8001`）
- 错误消息脱敏：不回显完整异常 / base URL / 凭证
