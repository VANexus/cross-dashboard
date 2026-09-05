# TODO.md — FlowMind 活路线图

> 最后一次重写：2026-09-05（对齐「阿里国际站铺货主线 + 对标 Supabase 的 AI-Native SaaS」方向）。
> 上一版 19 条的历史条目已在文末「已消化」节归档，不再逐一维护。

---

## U · 产品体验统一（2026-09-05 启动 · 治理「重复造轮子/离散/不连贯」）

> 用户反馈主线：多个子系统各造一套卡片/导航/流程，互不衔接。本次统一 = **单一数据源 + 复用组件 + 跨页快速衔接**。

- **U1 导航统一（✅）**：侧栏从硬编码三桶改为产品语义分桶（概览指挥/市场洞察/内容与发布/商品上架/AI 工作流/系统与运营/AI 动态页面）；`成果库` 单入口（去掉 growth 里同 URL 重复项）；AI 上架工作流隐藏只留命令面板；idle 状态点不再渲染 + 图例。
- **U2 洞察与工具（✅）**：
  - 灵感热榜修复：inspiration 榜从 baidu（量太少）改映射 **zhihu**（content.selfhost.ts）
  - 每日卡片产品化：去 pg_cron/TikHub 常驻术语 →「每日自动更新（08:00）+ 立即运行 + 自动定时设置入口」
  - 封面反推：URL 输入 → **上传图片（MinIO 复用 upload 路由，20MB）为主 + 粘贴链接为辅 + 即时预览**
  - 情报中心：头部「洞察→行动」衔接条，关键词一键带往 一键上架/关键词趋势/内容工坊
- **U3 内容统一主线（进行中）**：小红书/公众号/情报中心贯通为「灵感→选题→AI 草稿→手工修→排版→发布→成果库」；`content_typeset` 已迁**自托管引擎**（lib/server/wechat-typeset.ts，确定性内联样式转换，默认零 MCP 依赖，`WECHAT_TYPESET_USE_MCP=1` 可切回）；发布就绪卡升级为三步入位 + 笔记卡带封面缩略/话题聚合。
- **U4 生图画布（后端 v1 ✅ · UI 待做）**：ComfyUI 式「项目 × 版本 × 分支」——`wf_image_projects` 表（迁移 0006）+ `ImageCanvasService` + `/api/workflows/ai-imaging/canvas`（root/branch/patch/delete/list，分支自动 B1/B2 编号、树状回溯、叶子保护删除）；下一步把 /workflows/ai-imaging 画布升级为「版本时间线 + 分支树 + 内置提示词速选 + 基于上版本重新生成」。

---

## 🎯 北极星

对标 **Supabase 形态的 AI 原生 SaaS** 平台；核心智能编排能力目标**超越阿里国际站 Accio**（趋势→选品→Listing→生图→发布→监控的全链路 AI 自主闭环 + 记忆自进化 + 人在环审批）。

- **当前策略**：AI 能力先行（Web Agent 对话编排 + 生成式 UI + 记忆系统已就绪），多租户/计费后置（**等用户模型文档**，届时启用 00013_saas_groundwork 的归属列）。
- **阿里国际站**：凭据暂未到位（ALIBABA_APP_KEY/SECRET/SESSION，工具已就绪）；**现在先把链路备到位，key 一到即通电**。

---

## ✅ 已消化（上一版 19 条的去向）

| 原条目 | 结论 | 归宿 |
|---|---|---|
| #8/9/10 RAK 冲突/共识/DAG | 死代码（RAK 引擎已归档） | 不再投入，保留库表仅作历史 |
| #15 生图 | 已实现 | `AI_IMAGE_API_*` 自举（SiliconFlow Kolors），image-skills 在用 |
| #19 运行记录表 | 已实现 | `wf_workflow_runs` 已建，run_workflow 落库 |
| #7 工作流状态硬编码 | 已实现 | wf_workflow_runs + workflow_statuses 联动 |
| #1 商品发布「假」 | **已迁移为真实链路** | 见 P0-0；旧 `workflow.service.publishListing` 桩（Amazon 语境）待删 |
| #2/#16 广告导出 | 仍有效 | 见 P1-5 |
| #3/#4/#5/#6/#11/#12/#13/#14/#17/#18 | 仍有效 | 见 P1 |

---

## P0 · 阿里国际站铺货主线（key 未到，先备好链路）

- **P0-0 发布引擎（✅ 已完成，等 key）**：`B2BService.publishListing` → TOP 协议 HMAC-MD5 直连 `alibaba.icbu.product.add`（b2b.service.ts）；草稿态管理（draft→uploading→uploaded/failed，`wf_b2b_listings`），POST `/api/b2b/listing/publish` 已暴露。
- **P0-1 发布接入 Agent 工具链（✅ 2026-09-05）**：只读 `b2b_listing_intel` 工具进 tool-registry（任意页可看铺货全局）；旧 Amazon 语境 `workflow.service.publishListing` 桩已删、旧路由改 410；页内 L2 `publishListingToAlibaba` 动作（既有）衔接。
- **P0-2 铺货全链路流水线（✅ 2026-09-05，草稿态）**：`launch_listing_pipeline` 工具（趋势→RAG 选品→AI 推荐→批量 Listing 草稿+主图落库，`limit≤6`）+ HTTP `POST /api/b2b/listing/pipeline` + `/b2b/listing` 页「批量铺货流水线」按钮。
- **P0-3 发布状态回查与管理（✅ 2026-09-05）**：`GET /api/b2b/listing/status-overview`（草稿计数 + 已上传货号对照 + 商品池规模，`?refresh=1` 阿里在线回查）。

## P1 · 数据真实化（S3/导出等依赖已备）

- **P1-5 广告导出（✅ 2026-09-05）**：POST 生成真实 CSV 落 `data/exports/`，`/export/download?file=` 安全下载（防穿越）；xlsx 暂降级 csv。
- **P1-6 补货订单持久化（✅ 已实现）**：`wf_restock_orders` + `insertRestockOrder`。
- **P1-7 Dashboard（✅ 已重构, 2026-09-05）**：数据层 os/PG 全真实（stats/system/business/alerts/trends/SOP run/overview 均 SQL 聚合，无假数据）；沉浸式对话画布 + 顶部常驻「系统真相总览」条（服务健康 PG/Redis/MCP/阿里/模型 + 用量六项 + 铺货漏斗）。
- **P1-8 真实化**：进化趋势按月 GROUP ✅、记忆用量（entries 统计+7日趋势）✅、竞品广告使用真实 `recentAnalyses` + `/api/b2b/ad-intel` ✅。**风控维度：❌ 废案（2026-09-05 拍板，不再维护假健康分）。**
- **P1-9 详情页 + 清理**：待评估（risk/memory/evolution 列表够用时可不做）；`dashboard-client.tsx` 已不存在（dashboard 已重构）。

## P2 · SaaS 化（待用户模型文档）

- **P2-10 多租户**：按用户模型文档确定 owner/org/workspace 模型 → 启用归属列 + RLS/行级隔离（现有数据已有 owner 预留列）。
- **P2-11 计费/配额/用量**：对标 Supabase 用量页的计量仪表盘，把 AI 调用/生图/趋势/存储变成可定价单元（OTel 已接入，可支撑用量统计）。
- **P2-12 AI 卖点深化**：Web Agent 编排能力扩展、记忆自进化闭环打磨、生成式 UI 组件库扩充、L0/L1/L2 人在环审批体系完善。

---

## 维护约定

- 本文件是「活文档」：条目完成即移到「已消化」并标注归宿文件/路由。
- 新需求按 P0→P1→P2 排序插入；引用代码路径一律以当前 `src/kernel` / `lib/server/**` 为准（旧 `lib/rak`、`lib/services` 等路径均已迁移，勿按旧文定位）。