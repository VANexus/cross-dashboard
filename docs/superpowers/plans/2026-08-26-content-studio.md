# 内容创作中心（Content Studio）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 cross-dashboard 从跨境电商垂直扩展为多垂直内容工作台——新增内容创作中心（小红书/公众号/抖音的文案、思路、热点、审计、配图），AI 逻辑与密钥全部下沉到 rak-flowmind（MCP 服务），前端通过 MCP 客户端调用并持久化到 SQLite。

**Architecture:** rak-flowmind 保持纯 MCP 通用工具（新增 5 个 `content_*` 技能 + `streamable-http` 暴露）；cross-dashboard 的 Next.js 服务端用 `@modelcontextprotocol/sdk` 作 MCP 客户端调用技能，结果落本地 SQLite。浏览器零密钥。

**Tech Stack:** Python 3.11 / FastMCP(mcp 1.28.1) / httpx / pydantic / ruff / pytest；Next.js 16.2.6 / Bun / TypeScript / sql.js / zod / `@modelcontextprotocol/sdk`。

## Global Constraints

- 密钥永不进 toml/commit：只进 `rak-flowmind/.env`（gitignored），经 `_secrets.get_api_key()` 读取。
- 云优先：无 key 显式报错，绝不静默降级 mock；仅显式 `backend="mock"` 用于测试。
- 错误永不静默：失败经 `SkillResult(ok=False/degraded=True)` 结构化返回。
- Python：注释/文档/提交信息中文，标识符英文；提交 `<type>: <中文描述>`；ruff 必须通过。
- 所有 API route 用 `withDb()` + `success()` envelope + `parseBody()`。
- SQLite JSON 列存 TEXT（`DEFAULT '[]'/'{}'`），Repository 写 `JSON.stringify()`、读 `parseJsonField()`。
- TS `bunx tsc --noEmit` 零错误、`bun run lint` 通过。
- 新增技能不改 `server.py`/`contracts.py`/`skill.py`/`rules.py` 之外的框架层。

---
## Phase A — rak-flowmind（Python）

### Task A1: ContentConfig + .env 密钥
**Files:**
- Modify: `rak-flowmind/src/flowmind/config.py`（末尾加 `ContentConfig` + 纳入 `FlowmindConfig`）
- Modify: `rak-flowmind/.env`（gitignored，追加两个密钥行）

**Interfaces:**
- Produces: `ContentConfig`（pydantic）字段：
  - `llm_api_base="https://api.longcat.chat/anthropic"`、`llm_api_key_env="LONGCAT_API_KEY"`、`llm_model="LongCat-2.0"`、`llm_timeout_s=60.0`
  - `image_api_base="https://api.ciyuansky.com"`、`image_api_key_env="CIYUANSKY_API_KEY"`、`image_model="gpt-image-2"`、`image_timeout_s=60.0`
  - `hot_topic_api_base="https://api-hot.imsyy.top"`、`hot_topic_endpoints={"xhs":"weibo","wechat":"toutiao","douyin":"douyin"}`、`hot_topic_limit=20`、`hot_topic_timeout_s=10.0`
  - `max_ideas=6`、`max_tags=6`、`max_copy_length=2000`、`audit_llm_enabled=True`
- 在 `FlowmindConfig` 加字段 `content: ContentConfig = Field(default_factory=ContentConfig)`

- [ ] Step 1: 在 `config.py` 追加 `ContentConfig` 并挂到 `FlowmindConfig.content`
- [ ] Step 2: `.env` 追加 `LONGCAT_API_KEY=ak_2G72wH2qT7KE91z2Vx3q09EP7SJ25`、`CIYUANSKY_API_KEY=sk-2kyg7kl38Y88PRX76bD524D6712446998b19Ce8615D04b02`（确认 git 忽略）
- [ ] Step 3: 校验 `uv run python -c "from flowmind.config import load_config; c=load_config().content; print(c.llm_model, c.hot_topic_endpoints)"` 输出正确

### Task A2: 通用 LLM 客户端
**Files:**
- Create: `rak-flowmind/src/flowmind/skills/_llm_client.py`

**Interfaces:**
- Produces:
```python
class LLMClientError(Exception):
    def __init__(self, message: str, category: str = "unknown", retriable: bool = False): ...

def llm_json(*, prompt: str, system: str, api_key: str,
             api_base: str = "https://api.longcat.chat/anthropic",
             model: str = "LongCat-2.0", max_tokens: int = 4096,
             timeout_s: float = 60.0, client: httpx.Client | None = None) -> dict:
    """Anthropic /v1/messages → 解析 content[type=text] 里的 JSON dict。"""
```
- 从 `_llm_translate.py` 抽取 `/v1/messages` 调用逻辑（保留 `_llm_translate` 原行为，其内部可改为调用本模块）。

- [ ] Step 1: 写 `_llm_client.py`（含 `LLMClientError`、`llm_json`；解析 text 块为 JSON dict，`category`/`retriable` 语义同现有）
- [ ] Step 2: 建 `tests/test_llm_client.py`：mock httpx transport 验证成功解析、超时 category、500 retriable、非法 JSON
- [ ] Step 3: 跑测试 `uv run pytest tests/test_llm_client.py -v` 全绿

### Task A3: 热点客户端
**Files:**
- Create: `rak-flowmind/src/flowmind/skills/_hot_topics_client.py`

**Interfaces:**
- Produces:
```python
class HotTopicError(Exception):
    def __init__(self, message: str, category: str = "unknown", retriable: bool = False): ...

def fetch_hot_topics(*, api_base: str, endpoint: str, limit: int = 20,
                     timeout_s: float = 10.0,
                     client: httpx.Client | None = None) -> list[dict]:
    """GET {api_base}/{endpoint} → data[] → [{word, heat:int, delta:int|None, url, source}]。
    兼容 DailyHotApi 的 {title,hot,hotValue,url} 与变体字段。"""
```

- [ ] Step 1: 写 `_hot_topics_client.py`（httpx GET、解析 `data[]`，字段容错）
- [ ] Step 2: 建 `tests/test_hot_topics_client.py`：正常解析、空 data、非 2xx、超时、字段变体
- [ ] Step 3: 跑测试全绿

### Task A4: 规则库 + 审计引擎
**Files:**
- Create: `rak-flowmind/src/flowmind/skills/_content_rules.py`

**Interfaces:**
- Produces:
```python
class AuditFinding(BaseModel):
    category: str   # "absolute"|"medical"|"advert"|"platform"|"finance"
    severity: str   # "error"|"warning"
    message: str
    suggestion: str
    matched_text: str | None = None
    rule_id: str | None = None

def audit_rules(platform: str, title: str, body: str, tags: list[str]) -> list[AuditFinding]:
    """确定性扫描：广告法绝对化用语/医疗功效/平台规范（小红书/公众号/抖音差异化规则）。"""
```
- 内置每平台规则（正则/关键词），至少覆盖：绝对化用语（最/第一/顶级/全网最低…）、医疗功效（治疗/根治/治愈…）、导流引导（微信/私信）、诱导分享（公众号）、数据无来源、金融夸大。

- [ ] Step 1: 写 `_content_rules.py`（每平台规则 + `audit_rules`）
- [ ] Step 2: 建 `tests/test_content_rules.py`：各平台命中/不命中断言
- [ ] Step 3: 跑测试全绿

### Task A5–A9: 五个内容技能
**Files:**
- Create: `rak-flowmind/src/flowmind/skills/content_idea_design.py`、`content_copywrite.py`、`content_hot_topics.py`、`content_audit.py`、`content_image_gen.py`
- Test: `tests/test_content_*.py`

**Interfaces（技能 id → 入参 → 出参 `SkillOutput.data`）:**
| id | 入参 | data |
|----|------|------|
| `content_idea_design` | platform:"xhs"\|"wechat"\|"douyin", subject, count(1-6) | `{platform, subject, ideas:[{angle,title,reason}]}` |
| `content_copywrite` | platform, subject, angle?, tone?, keywords? | `{platform, subject, title, body, tags:[]}` |
| `content_hot_topics` | platform, limit?, refresh? | `{platform, source, degraded, topics:[{word,heat,delta,url,source}]}`（degraded 契约） |
| `content_audit` | platform, title, body, tags[] | `{platform, passed, findings:[{category,severity,message,suggestion,matched_text,rule_id}], llm_reviewed}` |
| `content_image_gen` | platform, prompt, scenes?[], count(1-4) | `{platform, width, height, images:[{index,url}]}` |

- 平台合法值统一 `"xhs"|"wechat"|"douyin"`（Pydantic Literal）。
- 提示词按平台风格（小红书种草/公众号长文/抖音口播）。
- 错误契约：`content_hot_topics` 走 degraded SkillOutput；其余 raise（`invoke()` 套信封）。
- `content_image_gen` 复用 `_image_backend.AllInApiBackend`（`api_base=ContentConfig.image_api_base`），平台→尺寸：xhs 1080x1440(3:4)、wechat 1920x822(16:9 头图)、douyin 1080x1920(9:16)。

- [ ] Step 1: 建 `tests/test_content_idea_design.py` 等五个测试（LLM/网络用 mock 或显式 `backend="mock"`）
- [ ] Step 2: 实现五个技能文件（模式照 `marketing_image_gen.py`：`@skill` + Pydantic 入参 + `SkillOutput` + 推理链）
- [ ] Step 3: 跑 `uv run pytest tests/test_content_*.py -v` 全绿

### Task A10: 注册技能 + HTTP 暴露入口
**Files:**
- Modify: `rak-flowmind/src/flowmind/skills/__init__.py`（加 5 行 import 注册）
- Modify: `rak-flowmind/pyproject.toml`（dependencies 加 `uvicorn>=0.30`；scripts 加 `flowmind-mcp-http = "flowmind.server_http:main"`）
- Create: `rak-flowmind/src/flowmind/server_http.py`
- Modify: `rak-flowmind/README.md`（HTTP 启动方式说明）

**Interfaces:**
- Produces: `server_http.main()` 以 `streamable-http` transport 启动 MCP 服务（host/port 可配，默认 `0.0.0.0:8001`），供 cross-dashboard 的 MCP Client 连接。

- [ ] Step 1: `__init__.py` 注册 5 技能
- [ ] Step 2: `server_http.py`：`mcp.run(transport="streamable-http", host=..., port=...)`（FastMCP v1 原生支持）
- [ ] Step 3: pyproject 加依赖 + script；`uv sync`
- [ ] Step 4: `uv run flowmind-mcp-http` 启动，`curl -s http://localhost:8001/` 探活；`uv run python -c "from flowmind import discover; print([s['id'] for s in discover()])"` 确认含 5 个 content_*
- [ ] Step 5: ruff + 全量 pytest 全绿

### Task A11: demo 脚本 + docs
**Files:**
- Create: `rak-flowmind/examples/content_*_demo.py`（happy/默认/错误三段式）
- Modify: `rak-flowmind/README.md` / `CLAUDE.md`（技能清单更新）

- [ ] Step 1: 写 5 个 demo 脚本（首行 `discover()`）
- [ ] Step 2: 跑全部 demo 无异常；文档更新

---
## Phase B — cross-dashboard（TypeScript）

### Task B1: Content 类型
**Files:**
- Modify: `cross-dashboard/lib/types.ts`

**Interfaces:** 新增并导出：
```ts
type ContentPlatform = "xhs" | "wechat" | "douyin";
interface IdeaAngle { angle: string; title: string; reason?: string }
interface HotTopic { word: string; heat: number; delta: number | null; url: string; source: string }
interface HotTopicsResult { platform: ContentPlatform; source: string; degraded: boolean; topics: HotTopic[] }
interface CopyDraft { id: string; platform: ContentPlatform; title: string; body: string; tags: string[]; status: "draft"|"published"|"archived"; auditPassed: boolean; auditResult: AuditFinding[] | null; imageCount: number; createdAt: string }
interface AuditFinding { category: string; severity: "error"|"warning"; message: string; suggestion: string; matchedText?: string; ruleId?: string }
interface ContentImage { index: number; url: string }
interface ContentWorks { drafts: CopyDraft[]; videos: LocalizeTask[] }
```

- [ ] Step 1: 在 `lib/types.ts` 追加上述类型

### Task B2: DB schema + 迁移 + 种子
**Files:**
- Modify: `cross-dashboard/lib/db/schema.ts`（新增 4 表 + 迁移列）
- Modify: `cross-dashboard/lib/db/index.ts`（迁移块 + 种子）

**数据表:** `wf_content_rules(id, platform, category, severity, pattern, label, suggestion, enabled)`、`wf_content_hot_topics(id, platform, word, heat, delta, url, source, fetched_at)`、`wf_content_ideas(id, platform, angle, title, subject, created_at)`、`wf_content_drafts(id, platform, title, body, tags TEXT DEFAULT '[]', status, audit_passed, audit_result TEXT DEFAULT '{}', image_count, created_at, updated_at)`；`wf_generated_images` 加 `platform`/`draft_id` 列（try/catch ALTER）。
- 种子：`wf_content_rules` ~40 条（三平台规则）、`wf_content_hot_topics` 每平台 5 条兜底热点。

- [ ] Step 1: schema.ts 加表 + ALTER 列
- [ ] Step 2: index.ts 加 idempotent 迁移 + 种子（规则只在表空时插入）
- [ ] Step 3: `bunx tsc --noEmit` 零错误

### Task B3: MCP 客户端 + 平台元数据
**Files:**
- Create: `cross-dashboard/lib/content/mcp-client.ts`
- Create: `cross-dashboard/lib/content/platforms.ts`
- Modify: `cross-dashboard/package.json`（依赖 `@modelcontextprotocol/sdk`）

**Interfaces:**
```ts
export interface ContentMCPConfig { url: string }   // FLOWMIND_MCP_URL 默认 http://localhost:8001
export class ContentMCPClient {
  constructor(cfg?: ContentMCPConfig);
  async call<T>(tool: string, args: Record<string, unknown>): Promise<T>;  // 结构化结果；失败抛 ContentMCPError
  async ping(): Promise<boolean>;  // tools/list 探活
}
export const PLATFORMS: { id: ContentPlatform; label: string; color: string; hint: string; imageAspect: string }[]
```

- [ ] Step 1: `bun add @modelcontextprotocol/sdk`
- [ ] Step 2: 写 `mcp-client.ts`（`Client` + `StreamableHTTPClientTransport`；错误分类 environment/transient）
- [ ] Step 3: 写 `platforms.ts`（沿用原型平台元数据）
- [ ] Step 4: `bunx tsc --noEmit` 零错误

### Task B4: Content Repository
**Files:**
- Create: `cross-dashboard/lib/repositories/content.repository.ts`
- Modify: `cross-dashboard/lib/repositories/index.ts`（export）

**Interfaces:** `insertDraft/updateDraft/getDrafts/getDraftById/deleteDraft/insertIdea/getIdeas/upsertHotTopics/getHotTopics/getRulesByPlatform/getRecentWorks`（均沿用 `parseJsonField`/`paginatedQuery`；camelCase↔snake_case 映射）

- [ ] Step 1: 实现 repository（照 `localize.repository.ts` 模式）
- [ ] Step 2: `bunx tsc --noEmit` 零错误

### Task B5: Content Service
**Files:**
- Create: `cross-dashboard/lib/services/content.service.ts`
- Modify: `cross-dashboard/lib/services/index.ts`（export `ContentService`）

**Interfaces:** `getPlatforms()`、`generateIdeas({platform,subject})`、`fetchHotTopics({platform,refresh?})`、`generateCopy({platform,subject,angle?,tone?})`、`auditDraft({id})`、`generateImages({draftId,platform,scenes})`、`getWorks()`——内部调 `ContentMCPClient` 对应技能，落库，`bumpWorkflowStatus`（idea-design/hot-topic/copywriting/compliance-audit/image-gen），错误结构化返回。

- [ ] Step 1: 实现 service（MCP 不可达 → 结构化 degraded 返回，不抛裸异常）
- [ ] Step 2: `bunx tsc --noEmit` 零错误

### Task B6: API 路由
**Files:**
- Create: `cross-dashboard/app/api/content-studio/{platforms,ideas,hot-topics,copywriting,audit,images,works}/route.ts` + `copywriting/[id]/route.ts`
- Modify: `cross-dashboard/lib/api-validation.ts`（Content Zod schema）

- [ ] Step 1: Zod schema（`contentIdeaSchema`、`copywritingSchema`、`auditSchema`、`imageSchema`、`updateDraftSchema`）
- [ ] Step 2: 各 route（`withDb` + `success()` + `parseBody`；POST 调用 service，GET 返回持久化数据）
- [ ] Step 3: `bunx tsc --noEmit` 零错误

### Task B7: Hooks + 页面重写
**Files:**
- Create: `cross-dashboard/hooks/use-content-studio.ts`
- Create: `cross-dashboard/app/content-studio/islands/content-studio-island.tsx`、`loading.tsx`、`error.tsx`
- Modify: `cross-dashboard/app/content-studio/page.tsx`（Suspense+island）、`content-studio-client.tsx`（重写，五功能卡片接 hooks + 成果库 tab 接 `getWorks`）

- [ ] Step 1: hooks（`useIdeas/useHotTopics/useDrafts/useWorks` + `generateCopy/auditDraft/generateImages`，基于 `useFetch`/`apiPost`）
- [ ] Step 2: island（SSR 拉平台/成果库/热点缓存 → props）
- [ ] Step 3: 重写 client：平台选择 + 产品输入 + 五卡片（思路设计/热点雷达标注数据源/生成文案复制/审计严重度着色/AI配图真实图）+ 成果库；MCP 不可达展示降级提示
- [ ] Step 4: `bunx tsc --noEmit` 零错误；`bun run dev` 手动冒烟

### Task B8: E2E + 视频本地化修复
**Files:**
- Create: `cross-dashboard/e2e/content-studio.spec.ts`
- Modify: `cross-dashboard/e2e/video-localization.spec.ts`、`lib/vl/client.ts:139-155`、`lib/services/localize.service.ts`（retry 透传原参数/时区/batch 提示）、`video-localization-client.tsx`（死 import/冗余 Suspense/download 校验）

- [ ] Step 1: 修 video-localization 10 处小问题
- [ ] Step 2: 补 `content-studio.spec.ts`（平台切换/思路生成/热点刷新降级/文案生成/审计展示/成果库）
- [ ] Step 3: `bun run test:e2e` 相关 spec 通过；全量 `bunx tsc --noEmit` + `bun run lint`

---
## 提交策略
- rak-flowmind：每个 Task 独立 commit（`feat: 新增内容技能…`），分支 `feat/content-studio`
- cross-dashboard：当前工作区 WIP 不动；新文件独立 commit（分支沿用 `feat/liquid-glass-redesign`，或新建 `feat/content-studio`）
