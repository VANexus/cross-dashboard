# TODO.md — FlowMind 未完成功能清单

> 每个条目标注了**需要你提供什么**才能完成实现。

---

## 🔴 P0 — 纯桩实现（返回假数据，用户误以为成功）

### 1. `publishListing()` — 商品发布是假的

**文件**: `lib/services/workflow.service.ts:247-258`
**现状**: 返回 `{ success: true, listingId: "lst-{timestamp}" }`，什么都没做。
**需要你提供**:
- 发布目标平台是什么？（Amazon SP-API？Shopify？自建站？）
- 是否需要对接真实的 Marketplace API？还是先做"草稿保存到数据库"的中间态？
- 如果对接 Amazon SP-API，需要提供 SP-API 的 credentials 存储方式（环境变量 or 数据库）

---

### 2. `exportAdData()` — 广告数据导出是假的

**文件**: `lib/services/workflow.service.ts:142-144`
**现状**: 返回 `{ url: "/exports/ad-data.csv", format: "csv" }`，从未生成文件。
**需要你提供**:
- 导出格式：CSV？Excel？JSON？
- 导出范围：全部关键词？还是按筛选条件？
- 文件存储位置：本地 `./data/exports/`？还是需要上传到 OSS/S3？
- 是否需要异步生成（大文件场景）？

---

### 3. `createRestockOrder()` — 补货订单是假的

**文件**: `lib/services/workflow.service.ts:316-326`
**现状**: 返回 `{ orderId: "PO-{timestamp}", status: "created" }`，无持久化。
**需要你提供**:
- 订单存储：是否需要新建 `restock_orders` 表？
- 对接系统：是否需要对接 ERP/供应链系统？还是先做本地记录？
- 订单状态流转：`created → approved → shipped → received`？需要哪些状态？

---

### 4. Dashboard 系统指标 — 全部硬编码

**文件**: `lib/services/dashboard.service.ts:37-48`
**现状**: `cpu: 42, memory: 68, disk: 55` 等固定值，永不变化。
**需要你提供**:
- 数据来源选项：
  - A) 使用 Node.js `os` 模块读取真实 CPU/内存（已可行，无需额外输入）
  - B) 对接 Prometheus/Grafana 等监控系统（需要 API 地址和认证方式）
  - C) 保持模拟但让它"动起来"（随机波动，纯展示用途）
- `activeConnections` 和 `taskQueueLength`：是否从数据库实时统计？

---

### 5. Dashboard 业务指标 — 全部虚构

**文件**: `lib/services/dashboard.service.ts:50-82`
**现状**: `revenue: 285600, profit: 68544, adSpend: 12580` 等完全虚构。
**需要你提供**:
- 数据来源：
  - A) 从 `wf_inventory` + `wf_ad_keywords` 表计算（已有数据可复用）
  - B) 对接 Amazon SP-API 的 Finance/Advertising 端点
  - C) 新建 `business_metrics` 表，手动或定时写入
- `costBreakdown`（采购/物流/广告/佣金）：是否有真实数据源？还是需要新建录入界面？

---

### 6. Dashboard 趋势数据 — `Math.random()` 生成

**文件**: `lib/services/dashboard.service.ts:99-105`
**现状**: `sales: [198000, 312000, ...]` 每次刷新都变。
**需要你提供**:
- 是否需要新建 `daily_metrics` 表存储每日汇总？
- 趋势周期：7天？30天？90天？
- 指标来源：从 tasks 表统计完成率趋势？从 wf_ad_keywords 统计广告趋势？

---

### 7. 工作流状态 — 完全硬编码

**文件**: `lib/repositories/workflow.repository.ts:267-276`
**现状**: 返回固定的 6 个工作流状态，`lastRun` 是静态日期。
**需要你提供**:
- 是否需要新建 `workflow_runs` 表来记录每次执行？
  ```
  workflow_runs: id, workflow_id, status, started_at, completed_at, result
  ```
- 状态如何更新：API 调用时自动记录？还是需要单独的"运行记录"机制？

---

## 🟠 P1 — 部分实现（架构完整但核心逻辑是模拟）

### 8. RAK 冲突解决 — `resolveByTimestamp` 和 `resolveByWeightedVote` 都选第一个 agent

**文件**: `lib/rak/conflict.ts:62-95`
**现状**: 两个策略都返回 `agents[0]`，注释写着"In a real system..."。
**需要你提供**:
- `resolveByTimestamp`: 每个 agent 结果是否需要带时间戳？数据结构怎么设计？
- `resolveByWeightedVote`: 权重来源是什么？
  - A) agent 的 `success_rate` 字段（已有）
  - B) 任务相关的历史表现
  - C) 手动配置的优先级权重

---

### 9. RAK 共识投票 — `tallyVotes()` 返回全零

**文件**: `lib/rak/consensus.ts:31-51`
**现状**: 始终返回 `{ accept: 0, reject: 0, abstain: 0, total: 0, passed: false }`。
**需要你提供**:
- 投票数据已存在 `rak_consensus_log.voters` JSON 字段中，只需读取并计数。这是一个**纯代码修复**，不需要额外数据。
- 但需要确认：`passed` 的判定逻辑是 `accept > total * threshold` 对吗？

---

### 10. RAK 任务执行 — 模拟而非真实调度

**文件**: `lib/rak/engine.ts:53-73`
**现状**: 循环遍历 DAG 节点直接标记 `completed`，不实际调度 agent。
**需要你提供**:
- 真实调度方式：
  - A) 通过 `coordinator.sendMessage()` 发送任务给 agent，等待 agent 回调完成
  - B) 调用 AI provider 执行节点任务（类似 workflow 的做法）
  - C) 保持模拟但增加延迟和随机失败，让演示更真实
- Agent 是"真实进程"还是"逻辑概念"？（当前 agents 表中的是数据库记录，没有对应的运行时进程）

---

### 11. 风控健康维度 — 大部分硬编码

**文件**: `lib/repositories/risk.repository.ts:123-138`
**现状**: 6 个维度中只有"账户安全"基于真实数据，其余 5 个是静态分数。5 个指标的趋势数组是虚构的。
**需要你提供**:
- 各维度的数据来源：
  - "数据合规" → 是否有合规检查表或审计记录？
  - "知识产权" → 是否需要对接商标/专利 API？
  - "广告合规" → 从 `wf_ad_keywords` 的 tag 统计？
  - "产品安全" → 从 `risk_events` 的 `source` 字段分类？
  - "供应链" → 从 `wf_inventory` 的 `ship_days` 统计？
- 指标趋势：是否需要新建 `risk_metrics_daily` 表记录每日 ODR/退货率等？

---

### 12. 进化趋势 — `Math.random()` 生成

**文件**: `lib/repositories/evolution.repository.ts:105-121`
**现状**: 月度成功率在真实平均值 ±10% 范围内随机波动。
**需要你提供**:
- 是否需要按月统计 `evolution_records` 的真实成功率？
  - 已有 `completed_at` 字段，可按月 GROUP BY
- 如果记录太少（当前只有 4 条），月度统计无意义，是否需要增加 seed 数据？

---

### 13. Memory 使用统计 — `workflows` 和 `trend` 硬编码

**文件**: `lib/repositories/memory.repository.ts:108-123`
**现状**: `workflows: ["选品", "广告", "Listing"]` 固定，`trend` 是虚构数组。
**需要你提供**:
- `workflows`：是否需要追踪哪个 workflow 引用了哪条 memory？
  - 如果是，需要新建 `memory_workflow_refs` 关联表
  - 如果否，可以删除这个字段或标记为"N/A"
- `trend`：是否需要记录 memory 的使用次数变化？需要使用日志表？

---

### 14. 竞品广告定向数据 — 空数组

**文件**: `app/workflows/competitor-ads/islands/competitor-ads-island.tsx:20`
**现状**: `targetingData={[]}`，UI 中定向数据区块永远为空。
**需要你提供**:
- `targetingData` 的数据结构是什么？（当前 types.ts 中没有定义）
- 数据来源：从 `wf_competitor_keywords` 推算？还是需要新的数据采集？

---

## 🟡 P2 — 功能缺失 / Bug

### 15. 图片生成 — 非 DALL-E 模型不支持

**文件**: `lib/image-gen/generator.ts:106-114`
**现状**: `generateGeneric()` 对 Stable Diffusion/Midjourney 直接抛错。
**需要你提供**:
- 是否需要支持其他模型？如果需要：
  - Stable Diffusion：自建 API 还是用 Replicate/RunPod？
  - Midjourney：是否有非官方 API？
  - 其他：FLUX、Ideogram 等？
- 如果暂时不需要，可以改为返回友好错误提示而非抛出异常

---

### 16. API 方法不匹配 — export 路由 405 错误

**文件**: `hooks/use-ai-advertising.ts` vs `app/api/workflows/ai-advertising/export/route.ts`
**现状**: Hook 用 `apiPost` 调用 export，但路由只定义了 `GET`。
**需要你提供**:
- 这是个 bug，修复方向：
  - A) 把路由改为 `POST`（推荐，因为需要传 `format` 参数）
  - B) 把 hook 改为 `apiGet`（但无法传 body）

---

## 🔵 P3 — 增强项

### 17. 详情页缺失

`/risk`、`/memory`、`/evolution` 有列表页但无 `[id]` 详情页。
**需要你提供**:
- 是否需要详情页？还是当前的模态框/行内展开已够用？
- 如果需要，详情页要展示哪些额外信息？（列表页已有的不需要重复）

---

### 18. 孤立文件清理

`app/dashboard/dashboard-client.tsx`（274 行）未被任何文件导入。
**需要你提供**:
- 确认可以删除？（已完全被 5 个 island 组件取代）

---

### 19. 工作流运行记录表

当前无表追踪工作流执行历史，导致 `getWorkflowStatuses()` 只能硬编码。
**需要你提供**:
- 是否需要新建 `workflow_runs` 表？
- schema 提议：
  ```sql
  CREATE TABLE workflow_runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    result TEXT,
    error TEXT
  );
  ```

---

## 📊 需要你决策的清单

| # | 问题 | 影响范围 |
|---|------|----------|
| 1 | publishListing 对接什么平台？ | 商品发布 workflow |
| 2 | exportAdData 导出到哪里、什么格式？ | 广告 workflow |
| 3 | createRestockOrder 需要持久化吗？新建表？ | 库存 workflow |
| 4 | Dashboard 指标用真实数据还是"会动的模拟"？ | 整个 Dashboard |
| 5 | RAK engine 的 agent 是逻辑概念还是真实进程？ | 整个 RAK 引擎 |
| 6 | 风控维度的数据来源是什么？ | 风控健康度 |
| 7 | workflow_runs 表是否需要？ | 工作流状态 |
| 8 | 图片生成是否需要支持非 DALL-E 模型？ | AI 制图 |
| 9 | export 路由改为 POST 还是 hook 改为 GET？ | 广告导出 |
| 10 | 详情页是否需要？ | risk/memory/evolution |
