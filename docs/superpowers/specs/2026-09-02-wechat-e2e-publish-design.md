# 微信公众号端到端发布 产品设计方案

日期：2026-09-02
状态：待评审
涉及项目：`cross-dashboard`（Next.js 16.2.6 Web 前端）、`rak-flowmind`（Python Skill SDK / MCP 服务）
关联文档：`docs/superpowers/specs/2026-08-26-content-studio-design.md`（内容创作中心，本方案在其上补齐公众号发布闭环）

---

## 1. 背景与目标

内容创作中心（Content Studio）已覆盖小红书/公众号/抖音的「选题 → 文案 → 配图 → 合规」，但公众号的**排版**与**发布**仍是断点：

- **排版**：后端 `content_wechat_e2e._to_html()` 仅用 `<p>` 裸包正文 + 图片追加，无任何公众号排版（无标题层级 / 引用 / 分割线 / 图文卡片 / 配色 / 内联样式）。
- **发布**：后端 `content_wechat_publish` / `content_wechat_e2e` 已具备「token → 封面上传 → 草稿 → 发布」能力，但前端无发布入口、无分步确认、无发布历史、无定时、无多账号。

本次目标：把公众号链路补齐为**端到端产品闭环**——

> 文案 → 排版（L3：AI 自动排版 + 可视化微调）→ 配图 → 合规 → **分步人工确认** → 发布（立即 / 定时 / 仅存草稿）→ 状态追踪与历史

并支持**无限多个公众号**：凭证由每个用户在前端录入（开发期沿用 env 自带账号），统一加密落库。

**明确不做（本期）**：多租户 SaaS 隔离、扫码授权（微信第三方平台模式）的完整落地——见 §5.3。

---

## 2. 范围

### 本期交付
1. 排版引擎 L3（AI 结构化排版 + TipTap 可视化编辑 + 手机预览）
2. 分步确认发布工作流（选题→文案→排版→配图→合规→发布设置→发布→追踪）
3. 公众号账号管理（多账号、加密落库、测试连接、开发期 env 账号）
4. 发布历史与状态轮询
5. 定时发布（服务端调度兜底）

### 后续（SaaS 阶段）
- 扫码授权（第三方平台 component 模式）
- 多租户隔离、账号配额、计费

---

## 3. 总体架构

保持既有「前端零密钥」架构：cross-dashboard 只经 MCP 调 rak-flowmind 技能，所有 AI 逻辑与云密钥下沉 flowmind。

```
浏览器 (cross-dashboard)
  ├─ content-studio 公众号 tab：分步发布向导（TipTap 排版 / 手机预览 / 发布设置 / 历史）
  ├─ 公众号账号管理（新增设置页）
  └─ Next.js Server (MCP Client)
        └─ Streamable HTTP ──► rak-flowmind (MCP Server)
             ├─ content_idea_design / content_copywrite / content_image_gen / content_audit   [复用]
             ├─ content_typeset            [新增] AI 结构化排版：Markdown → 公众号 HTML（样式内联）
             ├─ content_wechat_publish     [增强] 封面 + 正文图转存 + 草稿 + 发布（+publish_time）
             └─ content_wechat_e2e         [增强] 全链路编排（含排版、分步、定时、历史）
```

---

## 4. 排版引擎设计（L3）

### 4.1 分层
- **内容层（AI 结构化）**：`content_copywrite` 增强输出**结构化 Markdown**：标题层级 / 引用 / 有序无序列表 / 分割线 / 加粗 / 强调色块标记 / 图片占位。
- **渲染层（自动排版）**：新增 `content_typeset` 技能，输入 `(markdown, theme_id)` → 输出公众号 HTML（**全部样式内联**）。
- **编辑层（人工微调）**：前端 TipTap 所见即所得 + 手机预览，微调后导出最终 HTML。

### 4.2 现成库选型（不重复造轮子）

| 用途 | 库 | 说明 |
|---|---|---|
| Markdown → 公众号 HTML | `markdown-it-py`（后端）/ `markdown-it`（前端） | 标准渲染器 |
| 公众号风格主题 | **doocs/md 主题 CSS（MIT）** | 现成多套公众号主题，vendored 后改内联；支持自定义 CSS |
| 可视化编辑器 | **`@tiptap/react` + `@tiptap/starter-kit`（React 19 兼容）** | headless，Tailwind v4 友好，契合现有栈 |
| 编辑器参考实现 | **`KID-1912/tiptap-appmsg-editor`（开源）** | 现成「TipTap 公众号编辑器」交互样板（样式库 / 模板插入 / 复制到后台） |
| 样式内联 | `css_inline`（py）/ `juice`（js） | 微信编辑器会剥离 `<style>` 块，必须把主题 CSS 内联到每个元素 |

**关键约束：所有样式必须内联**（微信后台粘贴富文本时 `<style>` 会被剥离，只保留行内样式）。

### 4.3 主题模板
- 内置 vendored doocs/md 免费主题 3~5 套（极简 / 商务 / 文艺 / 科技 / 促销），每用户 / 每公众号可绑定默认主题。
- 支持「自定义 CSS」：用户在设置里粘贴 CSS，系统用 `juice` / `css_inline` 内联。
- 前端手机预览：375px iframe 渲染最终 HTML。

### 4.4 数据流
```
copywrite(结构化Markdown) → typeset(md + theme → 内联HTML) → TipTap 加载编辑 → 最终HTML
                                                             ↘ 手机预览
```

---

## 5. 公众号账号与凭证（多公众号）

### 5.1 存储
- 新增 SQLite 表 `wf_wechat_accounts`（与 `wf_content_*` 同域，后续可迁 Supabase `channel_accounts`）。
- **凭证加密**：AppSecret 用 AES-256-GCM 加密（复用 `channel_accounts` 同款：`base64(iv|tag|cipher)`，主密钥 `CHANNEL_VAULT_KEY` 只走环境变量）。
- **两种来源**：
  - `source='env'`：开发期系统默认账号，读 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`（env），前端展示「开发环境账号」，不可删。
  - `source='db'`：用户在前端录入，加密落库。

### 5.2 录入与校验
- 前端表单：公众号名称 + AppID + AppSecret → 保存前自动「测试连接」（调 `get_access_token` 成功 + 拉取账号昵称）→ 通过才允许保存。
- 状态：`active`（测试通过）/ `expired`（token 失败，提示重填 / 检查 IP 白名单）/ `untested`。
- 一个用户可绑定**任意多个**公众号，发布时下拉选择。

### 5.3 扫码授权（真实可行性 + 结论）

**结论：本期不做，数据模型预留。**

公众号「扫码授权」= 微信**第三方平台（component）模式**，前置条件苛刻：
1. 需在微信开放平台**注册第三方平台**（企业主体 + 开发者资质认证，且需全网发布）；
2. 需配置授权回调域名、事件接收 URL、第三方平台 AppSecret；
3. 流程：`component_access_token → pre_auth_code → 扫码授权页 → authorization_code → authorizer_access_token / refresh_token`。

这是企业级 SaaS（微盟 / 有赞等）的路径，单开发者成本与维护量大。**本期主路径：填 AppID + Secret + 自动测试连接（唯一可行）。**

**数据模型预留**：`wf_wechat_accounts` 增加 `authorizer_appid` / `authorizer_refresh_token_enc` / `component_appid` 字段，二期扫码授权直接复用，无需迁移。

---

## 6. 发布工作流（分步人工确认）

### 6.1 状态机
```
draft → idea_confirmed → copy_confirmed → typeset_confirmed → image_confirmed
      → audit_passed → publish_settings → submitted(immediate|scheduled|draft_only)
      → publishing → published | failed | cancelled
```
每一步：前端展示 AI 结果 → 用户 **[确认] / [编辑] / [重新生成]**，全部确认后才可进入发布设置。

### 6.2 发布执行（增强 content_wechat_publish）
现有：token → 封面上传（`material/add_material`）→ 草稿（`draft/add`）→ 发布（`freepublish/submit`）。

增强：
1. **正文图片转存**：`media/uploadimg` 把 AI 生图 / 外部图转成微信 mmbiz URL（当前直接塞外链会裂）。
2. **定时发布**：`freepublish/submit` 支持 `publish_time`（需公众号权限，以官方文档为准）；**兜底方案**：服务端定时任务到点触发（复用项目已有 cron 基建），不依赖该权限。
3. **发布后追踪**：`freepublish/get` 轮询最终状态 → `freepublish/getarticle` 拿文章 URL → 写入发布历史。
4. **token 缓存**：access_token 每日 2000 次调用限制 → 服务端缓存。

### 6.3 发布模式
- 立即发布（freepublish）
- 定时发布（见 6.2）
- 仅存草稿（draft_only，人工在公众号后台确认）
- （后续可选）群发（`mass/sendall`，推送粉丝，受次数限制）——本期默认不做，仅「发布」。

---

## 7. 数据模型（SQLite，JSON-as-TEXT 约定）

```sql
-- 公众号账号（凭证加密）
CREATE TABLE wf_wechat_accounts (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'db',            -- env | db
  app_id TEXT NOT NULL DEFAULT '',
  secret_enc TEXT NOT NULL DEFAULT '',           -- AES-256-GCM
  status TEXT NOT NULL DEFAULT 'untested',       -- active | expired | untested
  last_test_at TEXT,
  authorizer_appid TEXT,                          -- 预留（扫码授权）
  authorizer_refresh_token_enc TEXT,              -- 预留（扫码授权）
  component_appid TEXT,                           -- 预留（第三方平台）
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 发布任务（分步确认 + 历史）
CREATE TABLE wf_wechat_publish_jobs (
  id TEXT PRIMARY KEY,
  draft_id TEXT,                                  -- 关联 wf_content_drafts
  account_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drafting',        -- 见 §6.1 状态机
  current_step TEXT NOT NULL DEFAULT 'idea',
  steps TEXT NOT NULL DEFAULT '[]',               -- [{step,status,output,updated_at}]
  publish_mode TEXT NOT NULL DEFAULT 'immediate', -- immediate | scheduled | draft_only
  publish_time TEXT,
  media_id TEXT,
  publish_id TEXT,
  article_url TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`wf_content_drafts` 增加列：`typeset_html TEXT, theme_id TEXT, account_id TEXT, publish_job_id TEXT`。

---

## 8. API 设计

```
# 账号管理
GET    /api/wechat/accounts                 列表（env 账号置顶）
POST   /api/wechat/accounts                 新增（AppID+Secret，加密落库）
POST   /api/wechat/accounts/[id]/test       测试连接（get_access_token + 拉昵称）
PUT    /api/wechat/accounts/[id]            更新
DELETE /api/wechat/accounts/[id]            删除（env 账号禁删）

# 排版
GET    /api/content-studio/typeset/themes   主题列表
POST   /api/content-studio/typeset          AI 排版（body + theme → 内联 HTML）

# 发布工作流
POST   /api/wechat/publish                  创建发布任务（从草稿/文案开始）
POST   /api/wechat/publish/[id]/steps       推进/确认某一步（confirm | edit | regenerate）
POST   /api/wechat/publish/[id]/submit      提交发布（immediate/scheduled/draft_only）
GET    /api/wechat/publish/[id]             任务状态 + 历史
GET    /api/wechat/publish                  发布历史列表
```

全部沿用 `withDb()` + `success()` envelope + `parseBody()` 配方。

---

## 9. 前端页面与交互

1. **content-studio → 公众号 tab 改造**：现有五个功能之上增加「发布」阶段，分步向导（见 §6.1）。
2. **排版编辑**：TipTap 编辑器（右侧手机预览），工具栏含公众号常用样式（字号 / 颜色 / 引用 / 分割线 / 卡片）。
3. **发布设置**：选择公众号账号 + 发布模式 + 定时时间 + 发布按钮。
4. **发布历史**：表格（标题 / 账号 / 模式 / 状态 / 文章链接 / 时间 / 操作）。
5. **公众号账号管理**：新增设置页（列表 + 添加表单 + 测试连接按钮 + 状态徽标）。

---

## 10. 依赖清单（新增，全部现成）

| 包 | 位置 | 用途 |
|---|---|---|
| `@tiptap/react` + `@tiptap/starter-kit` | cross-dashboard | 可视化排版编辑 |
| `markdown-it` | cross-dashboard | 前端排版渲染（预览） |
| `juice` | cross-dashboard | 样式内联（发布前） |
| `markdown-it-py` | rak-flowmind | 后端 AI 排版渲染 |
| `css_inline` | rak-flowmind | 后端样式内联 |
| doocs/md 主题 CSS（MIT） | 两处 | 公众号风格主题库 |

前端无新增密钥；加密用 Node 内置 `node:crypto`。

---

## 11. 阶段实施计划

| 阶段 | 内容 | 依赖 |
|---|---|---|
| P0 发布闭环 | env 账号 + 立即发布 / 仅存草稿 + 测试连接 + 前端发布入口 + 发布历史 | 现有 wechat_publish skill |
| P1 排版 L1 | content_typeset + doocs 主题 + 预览 + 复制 HTML | 主题库 vendored |
| P2 排版 L2 | TipTap 编辑器 + 手机预览 + 自定义 CSS | P1 |
| P3 定时 | 服务端调度 + publish_time（按权限） | P0 |
| P4 多账号 | DB 账号 + 加密 + 添加 / 测试 / 管理 UI | P0 |
| P5（后续） | 扫码授权（第三方平台）、SaaS 多租户 | 企业资质 |

---

## 12. 风险与前置条件

1. **账号认证**：发布 / 定时接口要求**已认证**公众号（企业主体或认证订阅号 / 服务号）；**2025-07 起个人主体、未认证账号被回收发布接口权限**。→ 用户已有可发布账号 ✅，但产品面向的每个用户都需认证号，需在录入时校验并提示。
2. **IP 白名单**：AppSecret 取 token 需把**部署服务器出口 IP** 加入公众号后台白名单（生效约 10 分钟）。开发期可用本机公网 IP。→ 部署检查清单项。
3. **正文图片**：必须 `media/uploadimg` 转存，否则外链图在微信内不可用。
4. **token 缓存**：每日 2000 次限制，服务端必须缓存。
5. **发布 vs 群发**：freepublish 发布的文章进「发布 / 图文」栏、不主动推送粉丝；如需推送走群发（受次数限制）。本期默认发布。
6. **扫码授权**：第三方平台模式需企业主体资质，本期不做（见 §5.3）。

---

## 13. 开放问题

1. 「发布」语义确认：默认 freepublish（进发布栏、不推送粉丝）够吗？是否需要「群发」推送？
2. 内置主题风格偏好：是否需要你提供 1~2 个参考公众号（配色 / 风格）用于定制内置主题？
3. 定时发布你账号是否有权限——部署后验证，方案已含服务端调度兜底。


---

## 14. 实施状态（2026-09-02，端到端落地第一版）

### 后端（已完成并测试）
- 新增 `content_typeset`（markdown-it-py + doocs/md 主题 CSS + css_inline 内联；内置 default/grace/simple 三主题）。
- 重写 `content_wechat_publish` v0.2（发布/群发双渠道、定时透传、账号 override、正文图 uploadimg 转存、media_id/msg_id 输出）。
- 新增 `content_wechat_account_test`（测试连接）、`content_wechat_publish_status`（状态查询）。
- 增强 `_wechat_client`：access_token TTL 缓存、mass_send、get_publish_status、uploadimg 转存等。
- 依赖 `markdown-it-py>=4.0`、`css-inline>=0.20`；技能注册；测试 603 passed。
- 主题 CSS 已 vendor 到 `src/flowmind/skills/_wechat_themes/`。

### 前端（已完成并验证：tsc / eslint / next build 全绿）
- Supabase 迁移：`supabase/migrations/00011_wechat_e2e.sql`（wf_wechat_accounts 加密保险库 + wf_wechat_publish_jobs 发布任务）。
- 页面 `/content-studio/wechat`（侧边栏「公众号端到端发布」）：
  - 发布工作台：选稿 → AI 排版（TipTap 富文本微调 + 手机预览）→ 发布设置（账号/渠道/定时/仅存草稿/摘要/作者/封面）→ 分步人工确认 → 发布/群发。
  - 账号管理：AppID/AppSecret AES-256-GCM 加密入库，列表只回掩码；测试连接（账号 / 显式凭证 / 环境变量三模式）。
  - 发布历史：状态徽章、轮询刷新、文章链接、删除。
- API：`/api/wechat/{accounts, accounts/[id], accounts/test, typeset, publish, publish/[id], publish/[id]/submit, publish/[id]/refresh}`。
- 前端依赖：@tiptap/react 等（TipTap v3，含 style 保真扩展防排版样式丢失）。

### 待用户操作（解锁真发验证）
1. **建表**：在 Supabase SQL Editor 执行 `supabase/migrations/00011_wechat_e2e.sql`（幂等）。
2. **凭证**：在 flowmind 环境变量设置 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`（开发模式），或直接在页面「账号管理」添加并测试。
3. **微信侧**：公众号后台将部署服务器出口 IP 加入白名单；账号需已认证（认证订阅号/服务号）才能用 freepublish 发布接口。
