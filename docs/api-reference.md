# FlowMind BFF API Reference

> 本文档描述 FlowMind 系统 BFF 层的全部 REST API 接口，供后端开发对接使用。
> Base URL: `/api`

---

## 通用约定

### 响应格式

所有接口统一返回以下 JSON 结构：

```json
// 成功
{
  "success": true,
  "data": { ... },
  "pagination": { "page": 1, "pageSize": 20, "total": 100, "totalPages": 5 }  // 可选
}

// 失败
{
  "success": false,
  "error": "错误信息",
  "code": 400,
  "details": { ... }  // 可选，Zod 校验错误详情
}
```

### 分页参数

支持分页的接口接受以下 query 参数：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码，从 1 开始 |
| `pageSize` | number | 20 | 每页条数 |

### HTTP 状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数校验失败 |
| 404 | 资源不存在 |
| 405 | 请求方法不允许 |

---

## 1. Dashboard

### `GET /api/dashboard`

获取仪表盘汇总数据。

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": { "activeAgents": 12, "successRate": 94.2, "avgResponseTime": 2.3, "memoryUsage": 78.5 },
    "businessMetrics": { ... },
    "workflows": [ ... ],
    "alerts": [ ... ],
    "trends": { "sales": [...], "acos": [...], "conversion": [...] }
  }
}
```

---

## 2. Agents（智能体）

### `GET /api/agents`

获取智能体列表。

**Query 参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `status` | string | 按状态筛选: `active`, `idle`, `offline` |
| `type` | string | 按类型筛选: `coordinator`, `specialist`, `monitor` |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "coordinator-001",
      "name": "FlowMind Coordinator",
      "type": "coordinator",
      "status": "active",
      "successRate": 96.5,
      "tasksCompleted": 1247,
      "avgResponseTime": 1.2,
      "capabilities": ["任务调度", "流程编排", "异常处理"],
      "description": "中央协调智能体，负责任务分配和流程管理",
      "subAgents": [ ... ]
    }
  ]
}
```

### `GET /api/agents/:id`

获取单个智能体详情（含子智能体列表）。

**Path 参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 智能体 ID |

**Response:** 同上单个 Agent 对象，额外包含 `subAgents` 数组。

---

## 3. Tasks（任务）

### `GET /api/tasks`

获取任务列表（分页）。

**Query 参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 页码 |
| `pageSize` | number | 每页条数 |
| `status` | string | 按状态筛选: `pending`, `in_progress`, `completed`, `failed` |
| `priority` | string | 按优先级筛选: `low`, `medium`, `high`, `critical` |

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "task-001",
        "title": "选品采集 — US",
        "description": "数据源: Amazon, TikTok, YouTube",
        "status": "in_progress",
        "priority": "high",
        "assignedAgents": ["ops-001", "marketing-001"],
        "steps": [
          { "id": "step-1", "name": "数据采集", "status": "completed", "agent": "ops-001", "startedAt": "...", "completedAt": "...", "duration": 45000 },
          { "id": "step-2", "name": "数据分析", "status": "in_progress", "agent": "ops-001", "startedAt": "..." }
        ],
        "createdAt": "2026-05-08T10:00:00Z",
        "updatedAt": "2026-05-08T10:30:00Z"
      }
    ],
    "pagination": { "page": 1, "pageSize": 20, "total": 156, "totalPages": 8 }
  }
}
```

### `POST /api/tasks`

创建新任务。

**Request Body:**
```json
{
  "title": "任务标题",
  "description": "任务描述",
  "priority": "high",            // 可选，默认 "medium"
  "assignedAgents": ["agent-id"] // 可选
}
```

### `PATCH /api/tasks/:id`

更新任务。

**Path 参数:** `id` — 任务 ID

**Request Body:** 部分更新，可包含 `title`, `description`, `status`, `priority`, `assignedAgents`

### `DELETE /api/tasks/:id`

删除任务。

### `PATCH /api/tasks/:id/steps/:stepId`

更新任务步骤状态。

**Request Body:**
```json
{
  "status": "completed",
  "output": "步骤输出结果"
}
```

---

## 4. Risk（风险管理）

### `GET /api/risk/events`

获取风险事件列表（分页）。

**Query 参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 页码 |
| `pageSize` | number | 每页条数 |
| `level` | string | 按等级筛选: `high`, `medium`, `low` |
| `resolved` | string | 按解决状态筛选: `true`, `false` |

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "risk-001",
        "level": "high",
        "title": "专利侵权风险 — 外观设计",
        "description": "检测到产品外观与 US Patent D987654 相似度 87%",
        "source": "专利检测 Agent",
        "actions": ["暂停该 SKU 上架", "联系法务评估", "修改产品设计"],
        "resolved": false,
        "createdAt": "2026-05-08T14:30:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

### `POST /api/risk/events`

创建风险事件。

**Request Body:**
```json
{
  "level": "high",
  "title": "风险标题",
  "description": "风险描述",
  "source": "来源",
  "actions": ["建议操作1", "建议操作2"]  // 可选
}
```

### `PATCH /api/risk/events/:id`

更新风险事件（如标记已解决）。

**Request Body:**
```json
{
  "resolved": true,
  "resolvedAt": "2026-05-09T10:00:00Z"
}
```

### `GET /api/risk/health`

获取系统健康度数据。

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 87,
    "dimensions": [
      { "label": "数据质量", "score": 92, "value": "92%", "threshold": "80%", "status": "pass" },
      { "label": "系统响应", "score": 85, "value": "2.3s", "threshold": "3s", "status": "pass" }
    ],
    "indicators": [
      { "name": "API 响应时间", "current": "2.3s", "threshold": "3s", "status": "safe", "trend": [...] }
    ]
  }
}
```

### `GET /api/risk/isolation`

获取隔离检查清单。

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      { "label": "账号隔离", "desc": "每个店铺独立 IP 和浏览器指纹", "checked": true },
      { "label": "支付隔离", "desc": "不同店铺使用不同支付方式", "checked": true }
    ]
  }
}
```

### `PATCH /api/risk/isolation`

更新隔离检查项。

**Request Body:**
```json
{
  "index": 2,
  "checked": true
}
```

---

## 5. Memory（记忆管理）

### `GET /api/memory`

获取记忆条目列表（分页）。

**Query 参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 页码 |
| `pageSize` | number | 每页条数 |
| `zone` | string | 按区域筛选: `preset`, `dev`, `prompt` |
| `type` | string | 按类型筛选 |
| `search` | string | 关键词搜索 |

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "mem-001",
        "zone": "preset",
        "title": "Amazon 广告规则",
        "content": "ACoS 目标 < 20%，自动降价阈值...",
        "type": "advertising",
        "tags": ["amazon", "广告", "规则"],
        "usageCount": 45,
        "verified": true,
        "createdAt": "2026-05-01T00:00:00Z",
        "updatedAt": "2026-05-08T12:00:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

### `POST /api/memory`

创建记忆条目。

**Request Body:**
```json
{
  "zone": "dev",
  "title": "记忆标题",
  "content": "记忆内容",
  "type": "experience",
  "tags": ["标签1", "标签2"]  // 可选
}
```

### `GET /api/memory/:id`

获取单个记忆条目详情。

### `PUT /api/memory/:id`

更新记忆条目。

**Request Body:** 部分更新，可包含 `title`, `content`, `tags`

### `DELETE /api/memory/:id`

删除记忆条目。

### `GET /api/memory/:id/usage`

获取记忆条目的使用统计。

**Response:**
```json
{
  "success": true,
  "data": {
    "memoryId": "mem-001",
    "count": 45,
    "trend": [3, 5, 7, 8, 6, 9, 7],
    "created": "2026-05-01T00:00:00Z",
    "modified": "2026-05-08T12:00:00Z",
    "workflows": ["ai-advertising", "ai-listing"]
  }
}
```

---

## 6. Evolution（进化管理）

### `GET /api/evolution`

获取进化记录列表（分页）。

**Query 参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 页码 |
| `pageSize` | number | 每页条数 |
| `stage` | string | 按阶段筛选 |
| `status` | string | 按状态筛选: `pending`, `in_progress`, `success`, `failed` |

### `POST /api/evolution`

创建进化记录。

**Request Body:**
```json
{
  "stage": "analysis",
  "title": "进化标题",
  "description": "进化描述",
  "agentId": "agent-id"
}
```

### `GET /api/evolution/:id`

获取单个进化记录详情（含 beforeMetrics）。

### `PATCH /api/evolution/:id`

更新进化记录。

**Request Body:** 部分更新，可包含 `status`, `improvement`, `afterMetrics`

### `GET /api/evolution/trend`

获取进化趋势数据。

**Query 参数:**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `months` | number | 6 | 返回最近 N 个月的趋势 |

**Response:**
```json
{
  "success": true,
  "data": {
    "labels": ["Dec", "Jan", "Feb", "Mar", "Apr", "May"],
    "data": [65, 70, 72, 78, 82, 87]
  }
}
```

---

## 7. Workflow — 选品工作流 (Product Research)

### `GET /api/workflows/product-research/data-sources`

获取数据源列表。

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": "amazon", "name": "Amazon 前台", "enabled": true, "status": "completed", "progress": 100 },
    { "id": "tiktok", "name": "TikTok", "enabled": true, "status": "completed", "progress": 100 }
  ]
}
```

### `GET /api/workflows/product-research/keywords`

获取关键词分析数据。

**Query 参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `marketplace` | string | 市场（当前未使用，预留） |

### `GET /api/workflows/product-research/pain-points`

获取用户痛点分析数据。

### `POST /api/workflows/product-research/execute`

执行选品采集任务。

**Request Body:**
```json
{
  "marketplace": "US",
  "sources": ["amazon", "tiktok", "youtube"],
  "keywords": ["pet water fountain"],
  "asins": ["B0EXAMPLE"]
}
```

---

## 8. Workflow — AI 作图 (AI Imaging)

### `GET /api/workflows/ai-imaging/images`

获取生成图片列表。

**Query 参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `type` | string | 按类型筛选: `main`, `scene` |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "img-1",
      "type": "main",
      "clipScore": 87,
      "ctrScore": 72,
      "overall": 81,
      "isBest": true,
      "prompt": "white background, product centered",
      "model": "SDXL-1.0",
      "seed": 42156
    }
  ]
}
```

### `PATCH /api/workflows/ai-imaging/images/:id`

更新图片状态（如标记为最佳）。

**Request Body:**
```json
{
  "isBest": true
}
```

### `GET /api/workflows/ai-imaging/storyboard`

获取视频分镜脚本。

### `POST /api/workflows/ai-imaging/generate`

执行 AI 作图任务。

**Request Body:**
```json
{
  "type": "main",
  "prompt": "描述提示词",
  "model": "SDXL-1.0",
  "seed": 12345,
  "referenceImageId": "img-1"
}
```

---

## 9. Workflow — AI 广告 (AI Advertising)

### `GET /api/workflows/ai-advertising/keywords`

获取广告关键词列表。

**Query 参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `type` | string | 按广告类型筛选: `SP`, `SB`, `SD` |
| `tag` | string | 按标签筛选: `high-acos`, `high-conversion`, `non-precise` |

### `PATCH /api/workflows/ai-advertising/keywords/:id`

更新广告关键词（如调整出价）。

### `POST /api/workflows/ai-advertising/export`

导出广告报告。

**Request Body:**
```json
{
  "format": "csv"
}
```

**Response:**
```json
{
  "success": true,
  "data": { "url": "/exports/ad-report-1715234567890.csv" }
}
```

---

## 10. Workflow — AI 上架 (AI Listing)

### `GET /api/workflows/ai-listing/infringement`

获取侵权词检测结果。

### `GET /api/workflows/ai-listing/categories`

获取类目推荐。

### `GET /api/workflows/ai-listing/bullets`

获取五点描述（Bullet Points）。

### `POST /api/workflows/ai-listing/generate`

执行 Listing 生成任务。

**Request Body:**
```json
{
  "keyword": "pet water fountain",
  "marketplace": "US",
  "language": "en",
  "category": "Pet Supplies",
  "tone": "professional"
}
```

### `POST /api/workflows/ai-listing/publish`

发布 Listing。

**Request Body:**
```json
{
  "title": "Smart Pet Water Fountain Pro",
  "bullets": ["Bullet 1", "Bullet 2", "Bullet 3", "Bullet 4", "Bullet 5"],
  "description": "Full product description...",
  "keywords": ["pet water fountain", "cat fountain"],
  "category": "Pet Supplies > Water Fountains",
  "marketplace": "US"
}
```

**Response:**
```json
{
  "success": true,
  "data": { "success": true, "listingId": "listing-1715234567890" }
}
```

---

## 11. Workflow — 库销比 (Inventory)

### `GET /api/workflows/inventory`

获取库存列表（分页）。

**Query 参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 页码 |
| `pageSize` | number | 每页条数 |
| `status` | string | 按状态筛选: `normal`, `warning`, `caution`, `stale`, `overstock` |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "inv-1",
      "sku": "PF-001-BK",
      "name": "Smart Pet Fountain Pro — Black",
      "stock": 1250,
      "dailySales": 45,
      "ratioDays": 28,
      "stockoutDate": "2026-06-06",
      "restockQty": 2000,
      "restockDate": "2026-05-15",
      "status": "normal",
      "trend": [...],
      "avgCost": 12.5,
      "shipDays": 30
    }
  ]
}
```

### `GET /api/workflows/inventory/restock-suggestions`

获取补货建议。

### `POST /api/workflows/inventory/restock-order`

创建补货单。

**Request Body:**
```json
{
  "items": [
    { "sku": "PF-001-BK", "qty": 2000, "method": "express" },
    { "sku": "FT-001", "qty": 3000, "method": "sea" }
  ]
}
```

---

## 12. Workflow — 竞品广告分析 (Competitor Ads)

### `GET /api/workflows/competitor-ads/keywords`

获取竞品关键词列表。

**Query 参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `type` | string | 按类型筛选: `core`, `longtail`, `competitor` |

### `GET /api/workflows/competitor-ads/competitors`

获取竞品列表。

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "Petlibro",
      "sp": 45,
      "sb": 30,
      "sd": 25,
      "coreKeywords": 28,
      "topPosition": 65,
      "targeting": "defense"
    }
  ]
}
```

### `GET /api/workflows/competitor-ads/positions`

获取广告位分布数据。

### `POST /api/workflows/competitor-ads/analyze`

执行竞品广告分析任务。

**Request Body:**
```json
{
  "asins": ["B0EXAMPLE1", "B0EXAMPLE2"],
  "marketplace": "US",
  "includeKeywords": true,
  "includeAdStructure": true
}
```

---

## 13. Workflow Status（工作流状态）

### `GET /api/workflows/status`

获取所有工作流的运行状态概览。

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "product-research",
      "name": "选品工作流",
      "href": "/workflows/product-research",
      "status": "idle",
      "lastRun": "2026-05-08T14:30:00Z",
      "runs": 45,
      "success": 92
    }
  ]
}
```

---

## 附录：TypeScript 类型定义

所有请求/响应的 TypeScript 接口定义位于 `lib/types.ts`，后端可参考该文件了解完整的数据结构。

### 核心类型索引

| 模块 | 主要类型 |
|------|----------|
| Agent | `Agent`, `SubAgent` |
| Task | `Task`, `TaskStep` |
| Risk | `RiskEvent`, `HealthDimension`, `RiskIndicator` |
| Memory | `MemoryEntry`, `MemoryUsageStats` |
| Evolution | `EvolutionRecord`, `BeforeMetrics` |
| Dashboard | `DashboardStats`, `BusinessMetrics`, `WorkflowStatus`, `Alert` |
| Product Research | `DataSource`, `ProductKeyword`, `PainPoint` |
| AI Imaging | `GeneratedImg`, `StoryboardFrame` |
| AI Advertising | `AdKeyword` |
| AI Listing | `InfringementWord`, `CategoryRec`, `BulletPoint` |
| Inventory | `InventoryItem`, `RestockSuggestion` |
| Competitor Ads | `KeywordItem`, `CompetitorEntry`, `AdPosition` |

### Zod 校验 Schema

所有请求体的 Zod 校验 schema 位于 `lib/api-validation.ts`，包含：

- `paginationSchema` — 分页参数
- `createTaskSchema` / `updateTaskSchema` / `updateStepSchema` — 任务相关
- `createMemorySchema` / `updateMemorySchema` — 记忆相关
- `createRiskEventSchema` / `updateRiskEventSchema` — 风险事件相关
- `createEvolutionSchema` / `updateEvolutionSchema` — 进化相关
- `updateAdKeywordSchema` / `generateImageSchema` / `updateImageSchema` — 工作流相关
- `generateListingSchema` / `publishListingSchema` — Listing 相关
- `executeResearchSchema` / `createRestockOrderSchema` / `analyzeCompetitorSchema` — 任务执行相关
- `updateIsolationSchema` — 隔离检查相关

---

*Generated: 2026-05-11 | FlowMind BFF Layer v1.0*
