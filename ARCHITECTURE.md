# FlowMind RAK 后端架构

> 跨境电商智能编排系统 — RAK 跨物种智能体协同网络后端架构

## 1. 系统概览

```
┌──────────────────────────────────────────────────────────────────┐
│                       Next.js 16 App Router                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Island   │  │ Client   │  │ API      │  │ AppShell │        │
│  │ (SSR)    │  │ (React)  │  │ Routes   │  │ (layout) │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┘        │
│       │              │              │                              │
│  ─────┴──────────────┴──────────────┴──────────────────────────── │
│                     Service Layer (lib/services/)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Agent    │  │ Task     │  │ Workflow │  │ Dashboard│        │
│  │ Service  │  │ Service  │  │ Service  │  │ Service  │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │              │              │              │              │
│  ─────┴──────────────┴──────────────┴──────────────┴──────────── │
│                    RAK Engine Layer (lib/rak/)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │Coordinat-│  │   Mesh   │  │ Conflict │  │Consensus │        │
│  │   or     │  │ Executor │  │ Resolver │  │  Engine  │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │              │              │              │              │
│  ─────┴──────────────┴──────────────┴──────────────┴──────────── │
│                    Data Layer                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Database │  │   AI     │  │  Agent   │  │  Crawler │        │
│  │ (SQLite) │  │ Provider │  │ Runtime  │  │ (Ziniao) │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

### 核心原则

1. **解耦** — 后端服务层不依赖 Next.js，可独立迁移到任何 Node/Bun 运行时
2. **领域驱动** — 按业务领域组织代码，而非按技术层
3. **RAK 原生** — 所有智能体交互通过 RAK 协议引擎
4. **Provider 无关** — AI 能力通过适配器模式接入，支持 Claude / OpenAI / Mock
5. **Agent 自主** — 智能体具有自主运行时，支持情绪、决策、日志等生命特征

## 2. 目录结构

```
lib/
├── rak/                          # RAK 协议引擎（核心）
│   ├── index.ts                  # 统一导出
│   ├── engine.ts                 # RAKEngine — 顶层编排器
│   ├── coordinator.ts            # Coordinator — 中央协调器
│   ├── mesh.ts                   # MeshExecutor — 分布式执行器（DAG）
│   ├── conflict.ts               # ConflictResolver — 冲突消解
│   ├── consensus.ts              # Consensus — 共识机制（拜占庭容错）
│   └── protocol.ts               # 协议类型定义（消息、DAG、共识）
│
├── agent-runtime/                # Agent 自主运行时
│   ├── runtime.ts                # AgentRuntime — 生命周期管理（setInterval 循环）
│   ├── brain.ts                  # AgentBrain 接口
│   ├── real-brain.ts             # RealAgentBrain — 真实 AI 决策
│   ├── demo-brain.ts             # DemoAgentBrain — 演示模式决策
│   ├── context.ts                # assembleContext — 上下文组装
│   ├── personas.ts               # Agent 人格配置
│   └── event-bus.ts              # AgentEventBus — 进程内事件分发
│
├── db/                           # 数据库层
│   ├── index.ts                  # Database 单例（sql.js WASM）+ 连接管理
│   ├── schema.ts                 # 表结构定义（CREATE TABLE）
│   ├── seed.ts                   # 初始数据填充
│   ├── compat.ts                 # CompatDatabase — bun:sqlite 兼容封装
│   └── init.ts                   # 自动初始化模块
│
├── repositories/                 # 数据访问层（Repository 模式）
│   ├── base.ts                   # 基础 Repository（paginatedQuery 等）
│   ├── agent.repository.ts       # Agent + SubAgent CRUD
│   ├── task.repository.ts        # Task + TaskStep CRUD
│   ├── risk.repository.ts        # RiskEvent + Health + Isolation
│   ├── memory.repository.ts      # MemoryEntry + Usage
│   ├── evolution.repository.ts   # EvolutionRecord + Trend
│   ├── workflow.repository.ts    # 所有工作流实体 CRUD
│   ├── journal.repository.ts     # Agent 日志 CRUD
│   └── rak.repository.ts         # RAK 引擎持久化（消息、冲突日志）
│
├── services/                     # 业务逻辑层
│   ├── index.ts                  # 统一导出
│   ├── agent.service.ts          # 智能体管理、心跳、状态
│   ├── task.service.ts           # 任务编排、DAG 执行
│   ├── risk.service.ts           # 风险检测、熔断、健康评估
│   ├── memory.service.ts         # 记忆管理、版本控制
│   ├── evolution.service.ts      # 进化引擎、指标追踪
│   ├── dashboard.service.ts      # 仪表盘聚合、实时指标
│   ├── workflow.service.ts       # 工作流执行协调
│   └── crawler.service.ts        # 爬虫数据管理
│
├── ai/                           # AI 能力层
│   ├── index.ts                  # 统一导出
│   ├── provider.ts               # AIProvider 接口定义
│   ├── openai.ts                 # OpenAI API 适配器
│   ├── mock.ts                   # Mock 适配器（开发/演示）
│   └── prompts.ts                # 提示词模板（选品/Listing/广告/竞品/关键词分析）
│
├── crawlers/                     # 爬虫实现
│   ├── index.ts                  # 统一导出
│   └── types.ts                  # 爬虫类型定义
│
├── ziniao/                       # 紫鸟浏览器桥接
│   └── client.ts                 # HTTP 客户端（工具发现/调用/店铺管理/页面操作）
│
├── image-gen/                    # 图片生成
│   ├── index.ts                  # 统一导出
│   ├── types.ts                  # 图片生成类型
│   └── generator.ts              # 图片生成器
│
├── types.ts                      # 共享类型定义
├── api-response.ts               # API 响应格式化
├── api-validation.ts             # Zod 验证 schema
├── api-helpers.ts                # withDb() 包装器
├── utils.ts                      # 工具函数
├── mock-data.ts                  # 种子数据（迁移过渡用）
├── mock-data-store.ts            # 旧内存存储（逐步废弃）
└── workflow-data-store.ts        # 旧工作流存储（逐步废弃）
```

## 3. 数据库 Schema（sql.js SQLite）

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
  config        TEXT NOT NULL DEFAULT '{}', -- JSON: AgentConfig（人格/目标/情绪/循环配置）
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sub_agents (
  id              TEXT PRIMARY KEY,
  parent_id       TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'offline',
  spawned_at      TEXT NOT NULL DEFAULT (datetime('now')),
  task_description TEXT NOT NULL DEFAULT ''
);

-- ========== 任务域 ==========

CREATE TABLE tasks (
  id              TEXT PRIMARY KEY,
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
  id              TEXT NOT NULL,
  task_id         TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  agent_id        TEXT NOT NULL DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  started_at      TEXT,
  completed_at    TEXT,
  output          TEXT,
  PRIMARY KEY (id, task_id)
);

-- ========== 风险域 ==========

CREATE TABLE risk_events (
  id              TEXT PRIMARY KEY,
  level           TEXT NOT NULL,            -- safe|level3|level2|level1
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL DEFAULT '',
  timestamp       TEXT NOT NULL DEFAULT (datetime('now')),
  resolved        INTEGER NOT NULL DEFAULT 0,
  resolved_at     TEXT,
  actions         TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE risk_isolation (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  label           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  checked         INTEGER NOT NULL DEFAULT 0
);

-- ========== 记忆域 ==========

CREATE TABLE memory_entries (
  id              TEXT PRIMARY KEY,
  zone            TEXT NOT NULL,            -- preset|dev|prompt
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  type            TEXT NOT NULL,            -- script|code|prompt|skill
  version         INTEGER NOT NULL DEFAULT 1,
  verified        INTEGER NOT NULL DEFAULT 0,
  tags            TEXT NOT NULL DEFAULT '[]',
  agent_id        TEXT,                     -- 关联 Agent（可选）
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== 进化域 ==========

CREATE TABLE evolution_records (
  id              TEXT PRIMARY KEY,
  stage           TEXT NOT NULL,            -- identify|generate|test|review|reuse
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  agent_id        TEXT NOT NULL,
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT,
  status          TEXT NOT NULL DEFAULT 'in_progress',
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
  status          TEXT NOT NULL DEFAULT 'pending',
  progress        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE wf_product_keywords (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword         TEXT NOT NULL,
  volume          INTEGER NOT NULL DEFAULT 0,
  cpc             REAL NOT NULL DEFAULT 0,
  competition     REAL NOT NULL DEFAULT 0,
  supply_demand   REAL NOT NULL DEFAULT 0,
  trend           TEXT NOT NULL DEFAULT '[]',
  ai_tag          TEXT NOT NULL DEFAULT 'potential',
  marketplace     TEXT NOT NULL DEFAULT 'US'
);

CREATE TABLE wf_pain_points (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  category        TEXT NOT NULL,
  count           INTEGER NOT NULL DEFAULT 0,
  pct             REAL NOT NULL DEFAULT 0,
  examples        TEXT NOT NULL DEFAULT '[]'
);

-- ========== AI 制图工作流 ==========

CREATE TABLE wf_generated_images (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,            -- main|scene|aplus
  url             TEXT NOT NULL DEFAULT '',
  clip_score      REAL NOT NULL DEFAULT 0,
  ctr_score       REAL NOT NULL DEFAULT 0,
  overall         REAL NOT NULL DEFAULT 0,
  is_best         INTEGER NOT NULL DEFAULT 0,
  prompt          TEXT NOT NULL DEFAULT '',
  model           TEXT NOT NULL DEFAULT '',
  seed            INTEGER NOT NULL DEFAULT 0,
  revised_prompt  TEXT,
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
  id              TEXT PRIMARY KEY,
  keyword         TEXT NOT NULL,
  impressions     INTEGER NOT NULL DEFAULT 0,
  clicks          INTEGER NOT NULL DEFAULT 0,
  spend           REAL NOT NULL DEFAULT 0,
  sales           REAL NOT NULL DEFAULT 0,
  acos            REAL NOT NULL DEFAULT 0,
  conversion      REAL NOT NULL DEFAULT 0,
  cpc             REAL NOT NULL DEFAULT 0,
  tag             TEXT NOT NULL DEFAULT '',
  type            TEXT NOT NULL DEFAULT 'SP',
  trend           TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE wf_ad_positions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  position        TEXT NOT NULL,
  share           REAL NOT NULL DEFAULT 0,
  trend           TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE wf_ad_analyses (
  id              TEXT PRIMARY KEY,
  keyword         TEXT NOT NULL DEFAULT '',
  current_data    TEXT NOT NULL DEFAULT '{}',
  result_json     TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
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

CREATE TABLE wf_generated_listings (
  id              TEXT PRIMARY KEY,
  keyword         TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT '',
  language        TEXT NOT NULL DEFAULT 'en',
  title           TEXT NOT NULL DEFAULT '',
  bullets         TEXT NOT NULL DEFAULT '[]',
  description     TEXT NOT NULL DEFAULT '',
  search_terms    TEXT NOT NULL DEFAULT '[]',
  seo_score       INTEGER NOT NULL DEFAULT 0,
  estimated_ctr   TEXT NOT NULL DEFAULT '',
  result_json     TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== 库存工作流 ==========

CREATE TABLE wf_inventory (
  id              TEXT PRIMARY KEY,
  sku             TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  stock           INTEGER NOT NULL DEFAULT 0,
  daily_sales     REAL NOT NULL DEFAULT 0,
  ratio_days      REAL NOT NULL DEFAULT 0,
  stockout_date   TEXT,
  restock_qty     INTEGER NOT NULL DEFAULT 0,
  restock_date    TEXT,
  status          TEXT NOT NULL DEFAULT 'normal',
  trend           TEXT NOT NULL DEFAULT '[]',
  avg_cost        REAL NOT NULL DEFAULT 0,
  ship_days       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE wf_restock_orders (
  id              TEXT PRIMARY KEY,
  items           TEXT NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'created',
  total_items     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
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
  strategy        TEXT NOT NULL DEFAULT 'complementary'
);

CREATE TABLE wf_competitor_keywords (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword         TEXT NOT NULL,
  volume          INTEGER NOT NULL DEFAULT 0,
  competition     REAL NOT NULL DEFAULT 0,
  cpc             REAL NOT NULL DEFAULT 0,
  trend           TEXT NOT NULL DEFAULT '[]',
  type            TEXT NOT NULL DEFAULT 'core'
);

CREATE TABLE wf_generated_research (
  id              TEXT PRIMARY KEY,
  marketplace     TEXT NOT NULL DEFAULT 'US',
  category        TEXT NOT NULL DEFAULT '',
  keywords        TEXT NOT NULL DEFAULT '[]',
  sources         TEXT NOT NULL DEFAULT '[]',
  result_json     TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE wf_generated_competitor_analysis (
  id              TEXT PRIMARY KEY,
  asins           TEXT NOT NULL DEFAULT '[]',
  marketplace     TEXT NOT NULL DEFAULT 'US',
  keywords        TEXT NOT NULL DEFAULT '[]',
  result_json     TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE wf_workflow_statuses (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  href            TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'idle',
  last_run        TEXT,
  run_count       INTEGER NOT NULL DEFAULT 0,
  success_rate    REAL NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 3.3 RAK 引擎表 + Agent 生命系统表

```sql
-- ========== Agent 生命系统 ==========

CREATE TABLE agent_journal (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'thought',  -- thought|decision|observation|reflection
  content         TEXT NOT NULL,
  context         TEXT NOT NULL DEFAULT '{}',
  mood_at         TEXT,                     -- JSON: {state, energy, lastUpdated}
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== RAK 协议消息 ==========

CREATE TABLE rak_messages (
  id              TEXT PRIMARY KEY,
  from_agent      TEXT NOT NULL,
  to_agent        TEXT NOT NULL,            -- '*' = 广播
  type            TEXT NOT NULL,            -- request|response|event|heartbeat
  protocol        TEXT NOT NULL DEFAULT 'rak-v1',
  payload         TEXT NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at    TEXT,
  ttl             INTEGER NOT NULL DEFAULT 30000
);

-- ========== RAK 冲突记录 ==========

CREATE TABLE rak_conflicts (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL,
  agents          TEXT NOT NULL DEFAULT '[]',
  conflict_type   TEXT NOT NULL,            -- resource|opinion|priority|data
  description     TEXT NOT NULL DEFAULT '',
  resolution      TEXT,
  resolved_at     TEXT,
  result          TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== RAK 共识日志 ==========

CREATE TABLE rak_consensus_log (
  id              TEXT PRIMARY KEY,
  proposal_id     TEXT NOT NULL,
  proposer        TEXT NOT NULL,
  voters          TEXT NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'pending',
  threshold       REAL NOT NULL DEFAULT 0.67,
  result          TEXT,
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
  dependencies    TEXT NOT NULL DEFAULT '[]',
  config          TEXT NOT NULL DEFAULT '{}',
  result          TEXT,
  started_at      TEXT,
  completed_at    TEXT
);

-- ========== 爬虫数据 ==========

CREATE TABLE crawl_results (
  id              TEXT PRIMARY KEY,
  store_id        TEXT NOT NULL,
  store_name      TEXT NOT NULL DEFAULT '',
  platform        TEXT NOT NULL DEFAULT '',
  url             TEXT NOT NULL DEFAULT '',
  data            TEXT NOT NULL DEFAULT '{}',
  timestamp       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== AI 配置 ==========

CREATE TABLE ai_config (
  key             TEXT PRIMARY KEY,
  value           TEXT NOT NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 3.4 系统指标（计算视图，不建表）

Dashboard 的 SystemMetrics、DashboardStats、BusinessMetrics 通过 SQL 聚合查询实时计算，不单独建表。

## 4. RAK 引擎架构

### 4.1 协议消息格式

```typescript
// rak/protocol.ts

const RAK_PROTOCOL_VERSION = "rak-v1";

type MessageType = "request" | "response" | "event" | "heartbeat";
type MessageStatus = "pending" | "delivered" | "acknowledged" | "failed";
type ConflictType = "resource" | "opinion" | "priority" | "data";
type ConflictStrategy = "timestamp_priority" | "weighted_vote" | "causal_order" | "arbitration";
type DAGNodeType = "task" | "decision" | "merge" | "start" | "end";

interface RAKMessagePayload {
  action: string;
  data: unknown;
  correlationId?: string;
}

interface RAKMessageInput {
  from: string;
  to: string;            // agent ID 或 '*' 表示广播
  type: MessageType;
  payload: RAKMessagePayload;
  ttl?: number;          // ms, 默认 30000
}

interface ConsensusProposal {
  id: string;
  proposer: string;
  proposal: unknown;
  threshold: number;     // 0-1, 默认 0.67
}

interface ConsensusVote {
  agentId: string;
  vote: "accept" | "reject" | "abstain";
  weight: number;
  reason?: string;
}

interface DAGDefinition {
  nodes: DAGNodeDefinition[];
  edges: { from: string; to: string }[];
}
```

### 4.2 核心组件

```
RAKEngine (顶层编排器)
├── Coordinator (中央协调器)
│   ├── sendMessage()        — 点对点消息发送
│   ├── broadcast()          — 广播消息
│   ├── getAvailableAgents() — 获取可用智能体
│   └── getPendingMessages() — 获取待处理消息
├── MeshExecutor (分布式执行器)
│   ├── createDAG()          — 创建 DAG
│   ├── getExecutionOrder()  — 拓扑排序
│   ├── startNode() / completeNode() — 节点状态管理
│   ├── isComplete() / hasFailures() — 完成状态检查
│   └── 并行执行 + 结果收集
├── ConflictResolver (冲突消解)
│   ├── detectTaskConflicts() — 冲突检测
│   ├── getConflicts()        — 获取冲突列表
│   └── resolve()             — 冲突解决（timestamp_priority / weighted_vote / causal_order / arbitration）
└── ConsensusEngine (共识机制)
    ├── createProposal()      — 创建提案
    └── resolve()             — 投票结算（拜占庭容错）
```

### 4.3 RAK 工作流示例

```
用户发起任务: "分析蓝牙耳机市场"
        │
        ▼
┌─ Coordinator ──────────────────────────────┐
│  1. 解析任务 → 拆解为 DAG 节点              │
│  2. 查找可用智能体 (getAvailableAgents)     │
│  3. 分配子任务 (sendMessage)                │
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

## 5. Agent 生命系统

### 5.1 运行时架构

```
AgentRuntime (lib/agent-runtime/runtime.ts)
│
├── 每个 Agent 一个 setInterval 循环
│   └── 周期: config.cycleConfig.intervalMs
│
├── 决策循环 (每周期):
│   1. wake        — 唤醒，检查状态
│   2. context     — assembleContext() 组装上下文（任务/记忆/日志/情绪）
│   3. think       — AgentBrain.think() 生成思考
│   4. journal     — 写入日志（type: thought）
│   5. decide      — AgentBrain.decide() 生成决策
│   6. journal     — 写入日志（type: decision）
│   7. mood        — updateMood() 更新情绪状态
│   8. emit        — 发送事件到 AgentEventBus
│
├── 情绪状态机:
│   6 种状态: focused | alert | tired | stressed | curious | satisfied
│   能量值: 0.0 ~ 1.0（决策消耗，空闲恢复）
│   转换规则: 基于能量值和活动类型自动切换
│
├── AgentBrain 接口:
│   ├── RealAgentBrain  — 调用真实 AI Provider
│   └── DemoAgentBrain  — 模拟决策（演示模式）
│
└── AgentEventBus:
    └── 进程内 EventEmitter，事件类型: thought|decision|observation|reflection|mood_change|memory_created
```

### 5.2 情绪状态转换

```
         ┌─────────┐
    ┌────│ focused │────┐
    │    └─────────┘    │
    ▼                   ▼
┌─────────┐       ┌──────────┐
│  alert  │       │ curious  │
└────┬────┘       └────┬─────┘
     │                  │
     ▼                  ▼
┌──────────┐      ┌───────────┐
│ stressed │      │ satisfied │
└────┬─────┘      └────┬──────┘
     │                  │
     └──────┬───────────┘
            ▼
       ┌─────────┐
       │  tired  │ ← 能量 < 0.3 时所有状态都可转入
       └─────────┘
```

## 6. AI Provider 抽象

### 6.1 接口定义

```typescript
// ai/provider.ts

interface AIProvider {
  readonly name: string;
  generate(params: GenerateParams): Promise<GenerateResult>;
  analyze<T>(params: AnalyzeParams): Promise<T>;
  generateImage?(params: ImageParams): Promise<ImageResult>;
}

type AIProviderName = "mock" | "claude" | "openai";
```

### 6.2 工作流 AI 集成

| 工作流 | AI 功能 | Provider 方法 |
|--------|---------|--------------|
| 选品 | 市场趋势分析、痛点识别 | `analyze()` |
| AI 制图 | 图片生成指令、评分预测 | `generate()` + `generateImage?()` |
| 广告 | 关键词优化、ACOS 预测 | `analyze()` |
| 商品发布 | Listing 生成、SEO 优化 | `generate()` |
| 库存 | 需求预测、补货建议 | `analyze()` |
| 竞品 | 竞争策略分析 | `analyze()` |

### 6.3 提示词模板

`lib/ai/prompts.ts` 包含五个领域的结构化提示词：

- `productResearchPrompt()` — 选品分析
- `listingGenerationPrompt()` — Listing 生成（支持多语言）
- `adOptimizationPrompt()` — 广告优化
- `competitorAnalysisPrompt()` — 竞品分析
- `adKeywordAnalysisPrompt()` — 关键词分析

每个提示词返回 `{ system, prompt, schema }`，schema 用于结构化 JSON 输出。

### 6.4 配置

```bash
# .env.local
AI_PROVIDER=mock          # mock | claude | openai
AI_MODEL=claude-sonnet-4-20250514
AI_BASE_URL=https://api.openai.com
AI_API_KEY=sk-...
AI_MAX_TOKENS=4096
AI_TEMPERATURE=0.7
AI_DEMO_MODE=true         # true = 使用模拟数据
```

配置存储在 `ai_config` 表中，启动时从环境变量同步。设置页面（`/settings`）提供可视化配置界面。

## 7. Service 层设计

### 7.1 服务列表

| Service | 职责 |
|---------|------|
| `AgentService` | 智能体管理、心跳、状态、子 Agent 生成 |
| `TaskService` | 任务创建、状态流转、步骤管理、DAG 执行 |
| `RiskService` | 风险检测、健康评估、熔断管理、隔离清单 |
| `MemoryService` | 记忆 CRUD、版本控制、使用统计 |
| `EvolutionService` | 进化记录、阶段追踪、指标对比 |
| `DashboardService` | 仪表盘聚合、实时统计、趋势分析 |
| `WorkflowService` | 工作流执行协调、状态管理 |
| `CrawlerService` | 爬虫数据管理、结果存储 |

### 7.2 API Route → Service 映射

```
API Route (Next.js)          Service Method
─────────────────────────    ─────────────────────
GET  /api/agents             agentService.list()
GET  /api/agents/[id]        agentService.getById(id)
POST /api/tasks              taskService.create(data)
GET  /api/tasks              taskService.list(filters)
GET  /api/dashboard          dashboardService.getStats()
POST /api/workflows/...      workflowService...
...
```

API Route 只负责：参数解析 → 调用 Service → 格式化响应。所有业务逻辑在 Service 层。

## 8. 数据流

### 8.1 请求生命周期

```
Client Request
    │
    ▼
API Route Handler (app/api/...)
    │  ← withDb() 确保数据库就绪
    │  ← Zod 验证 (api-validation.ts → parseBody())
    │  ← 参数提取 (searchParams, params)
    ▼
Service Layer (lib/services/)
    │  ← 业务逻辑
    │  ← RAK 引擎交互（如需要）
    │  ← AI Provider 调用（如需要）
    ▼
Repository Layer (lib/repositories/)
    │  ← SQL 查询
    ▼
SQLite Database (lib/db/ → sql.js WASM)
```

### 8.2 SSR 数据流（Island 模式）

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
Props → Client Component (*-client.tsx)
    │  ← 渲染交互式 UI
    │  ← hooks/use-*.ts 管理客户端状态
    ▼
User Interaction
    │  ← fetch('/api/...') 变更操作
    ▼
API Route → Service → Repository → SQLite
```

## 9. 爬虫子系统

### 9.1 紫鸟浏览器桥接

```
cross-dashboard                    紫鸟浏览器
    │                                  │
    │  GET /zclaw/tools                │
    │  ─────────────────────────────→  │  工具发现（无需认证）
    │                                  │
    │  POST /zclaw/tools/invoke        │
    │  Header: X-ZClaw-Api-Key         │
    │  ─────────────────────────────→  │  工具调用（需认证）
    │                                  │
    │  ← { ret: 0, data: {...} }       │
```

支持的工具：`list_stores`、`open_store`、`close_store`、`visit_page`、`get_page_content`、`query_elements`、`click_element`、`input_text`、`take_screenshot`、`execute_script`、`run_automation`、`extract_data`、`get_logs`。

### 9.2 数据采集类型

```typescript
interface ProductData {
  asin: string; title: string; price: number;
  rating: number; reviewCount: number; bsr: number;
  category: string; imageUrl: string; url: string;
}

interface KeywordData {
  keyword: string; volume: number;
  cpc: number; competition: number; trend: number[];
}
```

## 10. 关键技术决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 数据库 | sql.js (SQLite WASM) | 零依赖、单文件、Bun/Node 通用 |
| ORM | 无（原生 SQL） | SQLite 简单够用，避免重依赖 |
| 迁移 | 轻量级（ALTER TABLE） | 单人项目，schema 变更少 |
| AI 适配 | Provider 接口 + 多实现 | 支持 Claude/OpenAI/Mock 灵活切换 |
| RAK 协议 | 自定义 v1 协议 | 核心差异化，需要完全控制 |
| Agent 运行时 | setInterval 循环 | 单机部署，简单可靠 |
| 事件系统 | 进程内 EventEmitter | 单机部署，不需要外部消息队列 |
| ID 生成 | `prefix-${Date.now()}` | 可读性好，兼容现有数据 |
| JSON 存储 | SQLite JSON 函数 | 原生支持，无需额外序列化层 |
| 浏览器桥接 | 紫鸟 ZClaw HTTP API | 防关联浏览器自动化 |
| 包管理 | Bun | 性能优异，内置 SQLite |

## 11. 依赖

### 运行时依赖

```
next 16.2.6, react 19.2.4, tailwindcss v4, sql.js, zod v4, zustand v5,
recharts v3, framer-motion v12, @radix-ui/*, @tanstack/react-table,
lucide-react, date-fns, class-variance-authority, clsx, tailwind-merge,
next-themes
```

### 开发依赖

```
@playwright/test, @tailwindcss/postcss, typescript 5, eslint 9,
eslint-config-next, bun-types, mammoth
```

### 无新增运行时依赖

Bun 内置 SQLite（通过 sql.js WASM），不需要 `better-sqlite3` 或 `drizzle-orm`。所有现有依赖保持不变。
