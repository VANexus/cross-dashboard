# FlowMind RAK Backend Architecture

> 跨境电商智能编排系统 — RAK 跨物种智能体协同网络后端架构

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js App Router                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Island   │  │ Client   │  │ API      │  │ Middleware│    │
│  │ (SSR)    │  │ (React)  │  │ Routes   │  │ (proxy)  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┘    │
│       │              │              │                         │
│  ─────┴──────────────┴──────────────┴─────────────────────── │
│                     Service Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Agent    │  │ Task     │  │ Workflow │  │ Dashboard│    │
│  │ Service  │  │ Service  │  │ Service  │  │ Service  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │              │              │              │          │
│  ─────┴──────────────┴──────────────┴──────────────┴──────── │
│                    RAK Engine Layer                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │Coordinat-│  │   Mesh   │  │ Conflict │  │Consensus │    │
│  │   or     │  │ Executor │  │ Resolver │  │  Engine  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │              │              │              │          │
│  ─────┴──────────────┴──────────────┴──────────────┴──────── │
│                    Data Layer                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Database │  │   AI     │  │  Event   │                   │
│  │ (SQLite) │  │ Provider │  │  Bus     │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### Core Principles

1. **Decoupled** — 后端服务层不依赖 Next.js，可独立迁移到任何 Node/Bun 运行时
2. **Domain-driven** — 按业务领域组织代码，而非按技术层
3. **RAK-native** — 所有智能体交互通过 RAK 协议引擎
4. **Provider-agnostic** — AI 能力通过适配器模式接入，支持 Claude / OpenAI / 本地模型

## 2. Directory Structure

```
lib/
├── rak/                          # RAK 协议引擎（核心）
│   ├── index.ts                  # 统一导出
│   ├── engine.ts                 # RAKEngine — 顶层编排器
│   ├── coordinator.ts            # Coordinator — 中央协调器
│   ├── mesh.ts                   # MeshExecutor — 分布式执行器
│   ├── conflict.ts               # ConflictResolver — 冲突消解
│   ├── consensus.ts              # Consensus — 共识机制（拜占庭容错）
│   ├── protocol.ts               # 协议类型定义（消息、帧、事务）
│   ├── encryption.ts             # 信息加密传输
│   └── scheduler.ts              # 任务调度器（DAG 编排）
│
├── db/                           # 数据库层
│   ├── index.ts                  # Database 单例 + 连接管理
│   ├── schema.ts                 # 表结构定义（CREATE TABLE）
│   ├── migrate.ts                # 迁移管理
│   └── seed.ts                   # 初始数据填充
│
├── repositories/                 # 数据访问层（Repository 模式）
│   ├── agent.repository.ts       # Agent + SubAgent CRUD
│   ├── task.repository.ts        # Task + TaskStep CRUD
│   ├── risk.repository.ts        # RiskEvent + Health + Isolation
│   ├── memory.repository.ts      # MemoryEntry + Usage
│   ├── evolution.repository.ts   # EvolutionRecord + Trend
│   ├── workflow.repository.ts    # 所有工作流实体 CRUD
│   └── rak.repository.ts         # RAK 引擎持久化（消息、冲突日志）
│
├── services/                     # 业务逻辑层
│   ├── agent.service.ts          # 智能体管理、心跳、状态
│   ├── task.service.ts           # 任务编排、DAG 执行
│   ├── risk.service.ts           # 风险检测、熔断、健康评估
│   ├── memory.service.ts         # 记忆管理、版本控制
│   ├── evolution.service.ts      # 进化引擎、指标追踪
│   ├── dashboard.service.ts      # 仪表盘聚合、实时指标
│   └── workflow.service.ts       # 工作流执行协调
│
├── ai/                           # AI 能力层
│   ├── index.ts                  # 统一导出
│   ├── provider.ts               # AIProvider 接口定义
│   ├── claude.ts                 # Claude API 适配器
│   ├── openai.ts                 # OpenAI API 适配器
│   ├── mock.ts                   # Mock 适配器（开发/演示）
│   └── prompts/                  # 提示词模板
│       ├── listing.ts            # 商品文案生成
│       ├── imaging.ts            # 图片生成指令
│       ├── advertising.ts        # 广告优化
│       ├── research.ts           # 选品分析
│       └── risk.ts               # 风险评估
│
├── types.ts                      # 共享类型定义（保留现有）
├── api-response.ts               # API 响应格式化（保留现有）
├── api-validation.ts             # Zod 验证 schema（保留现有）
├── utils.ts                      # 工具函数（保留现有）
├── mock-data.ts                  # 种子数据（保留现有，用于迁移过渡）
├── mock-data-store.ts            # 旧内存存储（逐步废弃）
└── workflow-data-store.ts        # 旧工作流存储（逐步废弃）
```

## 3. Database Schema (Bun SQLite)

### 3.1 核心领域表

```sql
-- ========== 智能体域 ==========

CREATE TABLE agents (
  id            TEXT PRIMARY KEY,           -- 'agent-{uuid}'
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,              -- sentinel|dispatch|operations|risk_control|legal|marketing
  status        TEXT NOT NULL DEFAULT 'offline',  -- online|busy|error|offline
  description   TEXT NOT NULL DEFAULT '',
  uptime        REAL NOT NULL DEFAULT 0,
  task_count    INTEGER NOT NULL DEFAULT 0,
  success_rate  REAL NOT NULL DEFAULT 0,
  last_heartbeat TEXT,                      -- ISO 8601
  reflex_level  INTEGER NOT NULL DEFAULT 0,
  config        TEXT NOT NULL DEFAULT '{}', -- JSON: 扩展配置
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sub_agents (
  id              TEXT PRIMARY KEY,         -- 'sub-{uuid}'
  parent_id       TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'offline',
  spawned_at      TEXT NOT NULL DEFAULT (datetime('now')),
  task_description TEXT NOT NULL DEFAULT ''
);

-- ========== 任务域 ==========

CREATE TABLE tasks (
  id              TEXT PRIMARY KEY,         -- 'task-{timestamp}'
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending|running|completed|failed|cancelled
  priority        TEXT NOT NULL DEFAULT 'medium',   -- low|medium|high|critical
  assigned_agents TEXT NOT NULL DEFAULT '[]',        -- JSON: Agent.id[]
  output          TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT
);

CREATE TABLE task_steps (
  id              TEXT PRIMARY KEY,         -- 's1', 's2', ...
  task_id         TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  agent_id        TEXT NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  started_at      TEXT,
  completed_at    TEXT,
  output          TEXT
);

-- ========== 风险域 ==========

CREATE TABLE risk_events (
  id              TEXT PRIMARY KEY,         -- 'risk-{timestamp}'
  level           TEXT NOT NULL,            -- safe|level3|level2|level1
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL DEFAULT '',
  timestamp       TEXT NOT NULL DEFAULT (datetime('now')),
  resolved        INTEGER NOT NULL DEFAULT 0,  -- boolean
  resolved_at     TEXT,
  actions         TEXT NOT NULL DEFAULT '[]'    -- JSON: string[]
);

CREATE TABLE risk_isolation (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  label           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  checked         INTEGER NOT NULL DEFAULT 0
);

-- ========== 记忆域 ==========

CREATE TABLE memory_entries (
  id              TEXT PRIMARY KEY,         -- 'mem-{timestamp}'
  zone            TEXT NOT NULL,            -- preset|dev|prompt
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  type            TEXT NOT NULL,            -- script|code|prompt|skill
  version         INTEGER NOT NULL DEFAULT 1,
  verified        INTEGER NOT NULL DEFAULT 0,
  tags            TEXT NOT NULL DEFAULT '[]',  -- JSON: string[]
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== 进化域 ==========

CREATE TABLE evolution_records (
  id              TEXT PRIMARY KEY,         -- 'evo-{timestamp}'
  stage           TEXT NOT NULL,            -- identify|generate|test|review|reuse
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  agent_id        TEXT NOT NULL,
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT,
  status          TEXT NOT NULL DEFAULT 'in_progress',  -- in_progress|success|failed
  metrics         TEXT,                     -- JSON: {accuracy, latency, coverage}
  before_metrics  TEXT                      -- JSON: {accuracy, latency, coverage}
);
```

### 3.2 工作流领域表

```sql
-- ========== 选品工作流 ==========

CREATE TABLE wf_data_sources (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  enabled         INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'pending',  -- completed|scraping|pending
  progress        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE wf_product_keywords (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword         TEXT NOT NULL,
  volume          INTEGER NOT NULL DEFAULT 0,
  cpc             REAL NOT NULL DEFAULT 0,
  competition     REAL NOT NULL DEFAULT 0,
  supply_demand   REAL NOT NULL DEFAULT 0,
  trend           TEXT NOT NULL DEFAULT '[]',   -- JSON: number[14]
  ai_tag          TEXT NOT NULL DEFAULT 'potential',  -- potential|competitive|risky
  marketplace     TEXT NOT NULL DEFAULT 'US'
);

CREATE TABLE wf_pain_points (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  category        TEXT NOT NULL,
  count           INTEGER NOT NULL DEFAULT 0,
  pct             REAL NOT NULL DEFAULT 0,
  examples        TEXT NOT NULL DEFAULT '[]'    -- JSON: string[]
);

-- ========== AI 制图工作流 ==========

CREATE TABLE wf_generated_images (
  id              TEXT PRIMARY KEY,         -- 'img-{timestamp}'
  type            TEXT NOT NULL,            -- main|scene|aplus
  clip_score      REAL NOT NULL DEFAULT 0,
  ctr_score       REAL NOT NULL DEFAULT 0,
  overall         REAL NOT NULL DEFAULT 0,
  is_best         INTEGER NOT NULL DEFAULT 0,
  prompt          TEXT NOT NULL DEFAULT '',
  model           TEXT NOT NULL DEFAULT 'SDXL-1.0',
  seed            INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE wf_storyboard_frames (
  id              TEXT PRIMARY KEY,
  description     TEXT NOT NULL,
  duration        TEXT NOT NULL,
  script          TEXT NOT NULL DEFAULT '',
  camera          TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0
);

-- ========== 广告工作流 ==========

CREATE TABLE wf_ad_keywords (
  id              TEXT PRIMARY KEY,         -- 'kw-{n}'
  keyword         TEXT NOT NULL,
  impressions     INTEGER NOT NULL DEFAULT 0,
  clicks          INTEGER NOT NULL DEFAULT 0,
  spend           REAL NOT NULL DEFAULT 0,
  sales           REAL NOT NULL DEFAULT 0,
  acos            REAL NOT NULL DEFAULT 0,
  conversion      REAL NOT NULL DEFAULT 0,
  cpc             REAL NOT NULL DEFAULT 0,
  tag             TEXT NOT NULL DEFAULT '',  -- high-acos|high-conversion|non-precise
  type            TEXT NOT NULL DEFAULT 'SP',  -- SP|SB|SD
  trend           TEXT NOT NULL DEFAULT '[]'   -- JSON: number[14]
);

CREATE TABLE wf_ad_positions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  position        TEXT NOT NULL,
  share           REAL NOT NULL DEFAULT 0,
  trend           TEXT NOT NULL DEFAULT '[]'   -- JSON: number[]
);

-- ========== 商品发布工作流 ==========

CREATE TABLE wf_categories (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  confidence      REAL NOT NULL DEFAULT 0,
  reason          TEXT NOT NULL DEFAULT '',
  bsr             INTEGER NOT NULL DEFAULT 0,
  fee             REAL NOT NULL DEFAULT 0
);

CREATE TABLE wf_bullet_points (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  seo_score       INTEGER NOT NULL DEFAULT 0,
  rufus           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE wf_infringement_words (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  word            TEXT NOT NULL,
  type            TEXT NOT NULL,             -- brand|patent|generic
  risk            TEXT NOT NULL DEFAULT '',
  action          TEXT NOT NULL DEFAULT ''
);

-- ========== 库存工作流 ==========

CREATE TABLE wf_inventory (
  id              TEXT PRIMARY KEY,         -- 'inv-{n}'
  sku             TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  stock           INTEGER NOT NULL DEFAULT 0,
  daily_sales     REAL NOT NULL DEFAULT 0,
  ratio_days      REAL NOT NULL DEFAULT 0,
  stockout_date   TEXT,
  restock_qty     INTEGER NOT NULL DEFAULT 0,
  restock_date    TEXT,
  status          TEXT NOT NULL DEFAULT 'normal',  -- normal|warning|caution|stale|overstock
  trend           TEXT NOT NULL DEFAULT '[]',
  avg_cost        REAL NOT NULL DEFAULT 0,
  ship_days       INTEGER NOT NULL DEFAULT 0
);

-- ========== 竞品分析工作流 ==========

CREATE TABLE wf_competitors (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  sp_count        INTEGER NOT NULL DEFAULT 0,
  sb_count        INTEGER NOT NULL DEFAULT 0,
  sd_count        INTEGER NOT NULL DEFAULT 0,
  keywords        INTEGER NOT NULL DEFAULT 0,
  rank            INTEGER NOT NULL DEFAULT 0,
  strategy        TEXT NOT NULL DEFAULT 'complementary'  -- offensive|complementary|defensive
);

CREATE TABLE wf_competitor_keywords (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword         TEXT NOT NULL,
  volume          INTEGER NOT NULL DEFAULT 0,
  competition     REAL NOT NULL DEFAULT 0,
  cpc             REAL NOT NULL DEFAULT 0,
  trend           TEXT NOT NULL DEFAULT '[]',
  type            TEXT NOT NULL DEFAULT 'core'  -- core|longtail|competitor
);
```

### 3.3 RAK 引擎表

```sql
-- ========== RAK 协议消息 ==========

CREATE TABLE rak_messages (
  id              TEXT PRIMARY KEY,         -- uuid
  from_agent      TEXT NOT NULL,
  to_agent        TEXT NOT NULL,            -- '*' = broadcast
  type            TEXT NOT NULL,            -- request|response|event|heartbeat
  protocol        TEXT NOT NULL DEFAULT 'rak-v1',
  payload         TEXT NOT NULL DEFAULT '{}',  -- JSON
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending|delivered|acknowledged|failed
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at    TEXT,
  ttl             INTEGER NOT NULL DEFAULT 30000  -- ms
);

-- ========== RAK 冲突记录 ==========

CREATE TABLE rak_conflicts (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL,
  agents          TEXT NOT NULL DEFAULT '[]',     -- JSON: Agent.id[]
  conflict_type   TEXT NOT NULL,            -- resource|opinion|priority|data
  description     TEXT NOT NULL DEFAULT '',
  resolution      TEXT,                     -- timestamp_priority|weighted_vote|causal_order|arbitration
  resolved_at     TEXT,
  result          TEXT,                     -- JSON: 解决结果
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== RAK 共识日志 ==========

CREATE TABLE rak_consensus_log (
  id              TEXT PRIMARY KEY,
  proposal_id     TEXT NOT NULL,
  proposer        TEXT NOT NULL,
  voters          TEXT NOT NULL DEFAULT '[]',  -- JSON: {agentId, vote, weight}[]
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending|accepted|rejected
  threshold       REAL NOT NULL DEFAULT 0.67,
  result          TEXT,                     -- JSON
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at     TEXT
);

-- ========== RAK 任务 DAG ==========

CREATE TABLE rak_dag_nodes (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'task',  -- task|decision|merge|start|end
  status          TEXT NOT NULL DEFAULT 'pending',
  assigned_agent  TEXT,
  dependencies    TEXT NOT NULL DEFAULT '[]',  -- JSON: node.id[]
  config          TEXT NOT NULL DEFAULT '{}',  -- JSON
  result          TEXT,                     -- JSON
  started_at      TEXT,
  completed_at    TEXT
);
```

### 3.4 系统指标（计算视图，不建表）

Dashboard 的 SystemMetrics、DashboardStats、BusinessMetrics 通过 SQL 聚合查询实时计算，不单独建表。

## 4. RAK Engine Architecture

### 4.1 协议消息格式

```typescript
// rak/protocol.ts

interface RAKMessage {
  id: string;
  from: string;           // agent ID
  to: string;             // agent ID or '*' for broadcast
  type: 'request' | 'response' | 'event' | 'heartbeat';
  protocol: 'rak-v1';
  payload: {
    action: string;       // e.g. 'assign_task', 'report_status', 'conflict'
    data: unknown;
    correlationId?: string; // 关联请求-响应
  };
  timestamp: string;
  ttl: number;            // ms, default 30000
  signature?: string;     // HMAC 签名
}

interface RAKConflict {
  id: string;
  taskId: string;
  agents: string[];
  conflictType: 'resource' | 'opinion' | 'priority' | 'data';
  description: string;
  resolution?: ConflictStrategy;
  result?: unknown;
}

type ConflictStrategy =
  | 'timestamp_priority'   // 时间戳优先级
  | 'weighted_vote'        // 加权投票
  | 'causal_order'         // 因果序
  | 'arbitration';         // 仲裁（人工介入）
```

### 4.2 核心组件

```
RAKEngine (顶层编排器)
├── Coordinator (中央协调器)
│   ├── AgentRegistry       — 智能体注册/发现/心跳
│   ├── TaskDispatcher      — 任务分发调度
│   └── MessageRouter       — 消息路由
├── MeshExecutor (分布式执行器)
│   ├── DAGScheduler        — DAG 拓扑排序 + 并行执行
│   ├── StepRunner          — 单步执行器
│   └── ResultCollector     — 结果收集 + 聚合
├── ConflictResolver (冲突消解)
│   ├── TimestampStrategy   — 时间戳优先级
│   ├── WeightedVoteStrategy — 加权投票
│   ├── CausalOrderStrategy — 因果序
│   └── ArbitrationStrategy — 仲裁（人类专家介入）
├── Consensus (共识机制)
│   ├── ProposalManager     — 提案管理
│   ├── VotingCollector     — 投票收集
│   └── ByzantineValidator  — 拜占庭容错验证
└── Encryption (信息安全)
    ├── MessageSigner       — HMAC 消息签名
    └── PayloadEncryptor    — 负载加密（AES-256）
```

### 4.3 RAK 工作流示例

```
用户发起任务: "分析蓝牙耳机市场"
        │
        ▼
┌─ Coordinator ──────────────────────────────┐
│  1. 解析任务 → 拆解为 DAG 节点              │
│  2. 查找可用智能体 (AgentRegistry)          │
│  3. 分配子任务 (TaskDispatcher)             │
│  4. 发送 RAK 消息 (MessageRouter)           │
└─────────────────────────────────────────────┘
        │
        ▼
┌─ MeshExecutor ─────────────────────────────┐
│  DAG:                                       │
│  [采集] ──┬── [分析A] ──┐                   │
│           └── [分析B] ──┼── [汇总] → [报告] │
│                         │                   │
│  并行执行分析A和分析B，等待两者完成          │
│  任一失败 → 触发冲突消解                     │
└─────────────────────────────────────────────┘
        │
        ▼ (如果冲突)
┌─ ConflictResolver ─────────────────────────┐
│  冲突类型: opinion (分析A和B结论不同)        │
│  策略: weighted_vote (按智能体权重投票)      │
│  结果: 采纳分析A的结论 (权重更高)            │
└─────────────────────────────────────────────┘
        │
        ▼
┌─ Consensus ────────────────────────────────┐
│  提案: 采用分析A的市场报告                   │
│  投票: 3/4 智能体同意 (75% > 67% 阈值)      │
│  结果: 提案通过，生成最终报告                │
└─────────────────────────────────────────────┘
```

## 5. AI Provider Abstraction

### 5.1 接口定义

```typescript
// ai/provider.ts

interface AIProvider {
  readonly name: string;

  // 文本生成
  generate(params: GenerateParams): Promise<GenerateResult>;

  // 结构化分析
  analyze<T>(params: AnalyzeParams): Promise<T>;

  // 图片生成（可选）
  generateImage?(params: ImageParams): Promise<ImageResult>;
}

interface GenerateParams {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

interface GenerateResult {
  content: string;
  usage: { input: number; output: number };
  model: string;
  latency: number;
}

interface AnalyzeParams {
  prompt: string;
  schema: ZodSchema;       // Zod schema 用于结构化输出
  data: unknown;
}
```

### 5.2 工作流 AI 集成

| 工作流 | AI 功能 | Provider 方法 |
|--------|---------|--------------|
| 选品 | 市场趋势分析、痛点识别 | `analyze()` |
| AI制图 | 图片生成指令、评分预测 | `generate()` + `generateImage?()` |
| 广告 | 关键词优化、ACOS 预测 | `analyze()` |
| 商品发布 | Listing 生成、SEO 优化 | `generate()` |
| 库存 | 需求预测、补货建议 | `analyze()` |
| 竞品 | 竞争策略分析 | `analyze()` |

### 5.3 配置

```bash
# .env.local
AI_PROVIDER=mock          # mock | claude | openai
ANTHROPIC_API_KEY=sk-...  # Claude API Key
OPENAI_API_KEY=sk-...     # OpenAI API Key
AI_MODEL=claude-sonnet-4-20250514  # 默认模型
```

## 6. Service Layer Design

### 6.1 服务接口（与 Next.js 解耦）

```typescript
// services/agent.service.ts
// 纯业务逻辑，不依赖 Next.js API

export class AgentService {
  constructor(
    private repo: AgentRepository,
    private rak: RAKEngine,
  ) {}

  async list(filters?: AgentFilters): Promise<Agent[]>;
  async getById(id: string): Promise<Agent | null>;
  async heartbeat(id: string): Promise<void>;
  async updateStatus(id: string, status: AgentStatus): Promise<void>;
  async spawnSubAgent(parentId: string, task: string): Promise<SubAgent>;
}
```

### 6.2 API Route → Service 映射

```
API Route (Next.js)          Service Method
─────────────────────────    ─────────────────────
GET  /api/agents             agentService.list()
GET  /api/agents/[id]        agentService.getById(id)
POST /api/tasks              taskService.create(data)
GET  /api/tasks              taskService.list(filters)
...
```

API Route 只负责：参数解析 → 调用 Service → 格式化响应。所有业务逻辑在 Service 层。

## 7. Data Flow

### 7.1 请求生命周期

```
Client Request
    │
    ▼
Next.js Middleware (proxy.ts)
    │  ← 安全头、Request ID
    ▼
API Route Handler
    │  ← Zod 验证 (api-validation.ts)
    │  ← 参数提取 (searchParams, params)
    ▼
Service Layer
    │  ← 业务逻辑
    │  ← RAK 引擎交互（如需要）
    ▼
Repository Layer
    │  ← SQL 查询 (bun:sqlite)
    ▼
SQLite Database
```

### 7.2 SSR 数据流（Island 模式）

```
Server Component (page.tsx)
    │
    ▼
Island Component (*-island.tsx)
    │  ← 直接调用 Service（不走 HTTP）
    ▼
Service → Repository → SQLite
    │
    ▼
Props → Client Component
```

## 8. Migration Strategy

### Phase 1: 并行运行
- 新 Repository 层使用 SQLite
- 旧 mock-data-store 保留，通过 feature flag 切换
- API Routes 改为调用 Service 层

### Phase 2: 逐步迁移
- 每个工作流逐个从 mock 切换到 SQLite
- 前端 hooks 保持不变（API 接口兼容）
- RAK 引擎逐步启用真实逻辑

### Phase 3: 完全切换
- 删除 mock-data-store.ts 和 workflow-data-store.ts
- 所有数据持久化到 SQLite
- RAK 引擎完整运行

### 命名约定（迁移友好）

| 层 | 命名规则 | 示例 |
|----|---------|------|
| RAK 模块 | `rak/` 目录，无前缀 | `import { Coordinator } from '@/rak'` |
| Repository | `{entity}.repository.ts` | `agent.repository.ts` |
| Service | `{entity}.service.ts` | `agent.service.ts` |
| 数据库表 | 核心: `{entity}` / 工作流: `wf_{entity}` / RAK: `rak_{entity}` | `agents`, `wf_inventory`, `rak_messages` |
| 类型导出 | 保留现有 `types.ts` 接口名 | `Agent`, `Task`, `RiskEvent` |

## 9. Key Technical Decisions

| 决策 | 选择 | 原因 |
|------|------|------|
| 数据库 | Bun SQLite (`bun:sqlite`) | 零依赖、单文件、性能极佳、比赛演示方便 |
| ORM | 无（原生 SQL） | SQLite 简单够用，避免 Prisma 等重依赖 |
| 迁移 | 手动 SQL schema | 单人项目，schema 变更少，不需要自动化迁移工具 |
| AI 适配 | Provider 接口 + 多实现 | 支持 Claude/OpenAI/Mock 灵活切换 |
| RAK 协议 | 自定义 v1 协议 | 核心差异化，需要完全控制 |
| 事件系统 | 进程内 EventEmitter | 单机部署，不需要 Redis 等外部消息队列 |
| ID 生成 | 保留 `prefix-${Date.now()}` | 兼容现有数据，可读性好 |
| JSON 存储 | SQLite JSON 函数 | 原生支持，无需额外序列化层 |

## 10. Dependencies

### 新增依赖（最小化）

```
无新增运行时依赖！
```

Bun 内置 SQLite，不需要 `better-sqlite3` 或 `drizzle-orm`。
AI SDK 按需安装：
- `@anthropic-ai/sdk` — Claude API（Phase 2+）
- `openai` — OpenAI API（Phase 2+）

### 保留现有依赖

所有现有依赖保持不变，前端代码无需修改。
