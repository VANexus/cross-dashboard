# FlowMind 后端依赖清单（Next.js 全栈自举后）

> 更新日期：2026-09-04（二轮迁移：趋势/长尾/生图 已从 flowmind-mcp 全部迁回 Next.js 自举）
> 原则：**能不依赖后端就不依赖后端，全面 Next.js 全栈自举**。以下按「已自举 / 必须后端 / GPU 必留」三档列明，并给出每项的依赖依据与可迁移性。

---

## A. 已全栈自举 —— Next.js 内直连，零后端（可立即使用）

| # | 能力 | 实现位置 | 依赖 | 说明 |
|---|------|----------|------|------|
| 1 | 选品调研 / AI 作图 / AI 广告 / AI 上架 / 库销比 / 竞品广告分析 | `lib/server/mastra/tools/local-tools.ts`（9 个 localTools） | PostgreSQL（直连） | 六大工作流数据全部走 `DATABASE_URL`，WorkflowService 直读 |
| 2 | 内容文案创作 | `selfhost-tools.ts` → `content_copywrite` | SiliconFlow LLM API | `getAISDKModel()`，无需 Python |
| 3 | 内容创意设计 | `content_idea_design` | SiliconFlow LLM API | 同上 |
| 4 | 发布前内容审核 | `content_audit` | **本地规则引擎**（违禁词/敏感词/极限词/广告法禁用）+ LLM | 规则层完全不依赖外部，离线可跑 |
| 5 | 图片/描述反推提示词 | `image_prompt_reverse` | SiliconFlow LLM API | 无外部图片服务 |
| 6 | 库存风险分析 | `inventory_risk` | PostgreSQL（`wf_inventory`） | 直读本地库 |
| 7 | B 端每日经营摘要 | `b2b_daily_digest` | PostgreSQL（`wf_inventory`/`wf_ad_keywords`/`tasks`/`risk_events`）+ LLM | 聚合本地业务数据 |
| 8 | **B 端关键词趋势**（TikTok/Instagram） | `lib/server/services/b2b.selfhost.ts` → `TikHubClient` | TikHub REST（`AI_TRENDS_API_KEY`） | **二轮迁移**：TT 热榜分页聚合 + IG 话题搜索，Bearer 直调，错误分类对齐 |
| 9 | **B 端长尾词** | `b2b.selfhost.ts` → `generateLongtail` | SiliconFlow LLM API（`getAISDKModel`） | **二轮迁移**：云 LLM 结构化 JSON 生成，替代后端 `b2b_longtail_keywords.py` |
| 10 | **AI 营销生图** | `b2b.selfhost.ts` → `generateImages` | SiliconFlow 生图 API（`AI_IMAGE_API_*`，模型 `Kwai-Kolors/Kolors`） | **二轮迁移**：OpenAI 兼容 `images/generations`，替代后端 `marketing_image_gen.py` + GPU 生图服务 |
| 11 | AI 推理总出口 | `lib/server/ai/index.ts` → `getAISDKModel()` | SiliconFlow（`.env` 的 `AI_LLM_API_KEY`） | 所有 LLM 调用统一走此出口 |
| 12 | RAK 引擎 / Agent 运行时 / 记忆 / 心跳 / 动态工作流 | `lib/rak/`、`lib/agent-runtime/`、`lib/server/agent/` | 纯 TS | 全前端内核，无后端 |
| 13 | 四库接入 | — | PG `cross` / Redis `30379` / Mongo `30417` / Milvus `31953`（`.env` 直写） | 全部直连，数据库即基础设施 |
| 14 | UI 编排（人在环中） | `lib/kernel/plugins/ui-actions.ts` + `agent-bus` | 纯前端 | 现有 UI = Agent 能力工作台，Agent 编排 UI 与人协作 |

**结论：A 档 14 项全部可在 Next.js 内独立运行，与 flowmind-mcp 后端完全解耦。**
**内核工具注册点 `src/kernel/plugins/tool-registry.ts` 中，趋势/长尾/生图三工具已不再依赖 ContentMCPClient（仅阿里域 / 反向提示词 / 推送 / 摘要编排仍走 MCP）。**

---

## B. 仍依赖 flowmind 后端（需外部平台授权，非自举）

| # | 能力 | 接入工具 | 后端依赖 | 可否迁移 |
|---|------|----------|----------|----------|
| 1 | 阿里在售商品池 / 商品推荐 | `alibaba_product_list` / `alibaba_product_recommend` | Alibaba OpenAPI 平台授权（`ALIBABA_APP_KEY` / `ALIBABA_APP_SECRET` / 卖家 SESSION） | **需平台授权**：`.env` 目前为空，授权后可在 Next.js 用 OpenAPI REST 直调（可自举，属业务凭证非基础设施） |
| 2 | 阿里 Listing 生成 / 发布 | `alibaba_listing_generate` / `alibaba_product_post` | 同上（OpenAPI + 商品内容） | 同上 |
| 3 | 推送测试（飞书/企微） | `b2b_push_feishu` / `b2b_push_wecom` | webhook 仅在后端配置 | 可迁移：webhook URL 已是业务凭证，可迁到 Next.js 直发 |
| 4 | 图片反向提示词 | `image_prompt_reverse` | LLM 视觉理解（走 MCP） | 可迁移：本质是 LLM 多模态调用，`getAISDKModel` 升级视觉模型后可自举 |
| 5 | 每日摘要编排 | `b2b_daily_digest` | 后端编排聚合 | 部分自举（本地数据聚合版已在 A 档 7）；趋势/长尾数据源已自举 |

**结论：B 档均为「业务凭证/授权」类依赖，不是「能力被后端锁死」；拿到授权后可按 A 档模式逐步自举。其中阿里域是唯一需要外部平台商家授权的能力。**

---

## C. GPU 重负载 —— 必留 GPU 后端（用户点名「目前来说，可能就视频本地化是」）

| 能力 | 链路 | 为什么必须 GPU |
|------|------|----------------|
| **视频本地化**（`localize_video`） | ffmpeg 提轨 → 百炼 Paraformer ASR → LongCat 翻译 → 抹除字幕 → **CosyVoice 音色克隆逐句配音** | 音色克隆（CosyVoice）与 ASR 均为 GPU 推理负载；ffmpeg 逐句合成需本地 GPU 算力，Next.js 单进程承载不了。**这是当前唯一真正必须 GPU 后端的能力。** |

---

## D. 后端其余技能（未接入前端 · 现状备忘）

| 技能 | 依赖 | 状态 |
|------|------|------|
| `content_wechat_publish` 公众号发布 | `_wechat_client`（微信客户端/登录态） | 未接入前端；需客户端会话，属外部依赖 |
| `_cloud_asr` / `_cloud_ocr` / `_cloud_tts` 云识别/合成 | 云端 API | 未接入前端；云 API 可从 Next.js 直调，可自举 |
| `feishu_kb` 飞书知识库同步 | 飞书 API | 未接入前端；飞书有开放 API，可在 Next.js 直调 |
| `content_typeset` / `content_copywrite`（后端版） | LLM | **已被 selfhost 版取代**（A 档 2/3） |

---

## 一张图结论

```
┌────────────────────────────────────────────────────────────┐
│  Next.js 全栈（flowmind.xrak.top）                            │
│  ├─ A 档：14 项能力自举（LLM/生图走 SiliconFlow、趋势走 TikHub、四库直连）│
│  └─ 剩余依赖 → flowmind-mcp（内网 GPU 服务器）                    │
│        ├─ B  阿里商品/Listing（需平台商家授权，可自举）             │
│        └─ C  视频本地化（CosyVoice 配音，GPU，唯一必留）            │
└────────────────────────────────────────────────────────────┘
```

**必须后端的最终最小集 = 视频本地化（GPU，CosyVoice 音色克隆）这一个能力。**
**趋势/长尾/生图 = 已全部迁回 Next.js 自举，零后端。**
**其余能力 = Next.js 已自举，零后端依赖。**
