/**
 * FlowMind RAK — Database Schema
 * Bun SQLite (bun:sqlite), zero dependencies
 */

export const SCHEMA_SQL = `
-- ========== 智能体域 ==========

CREATE TABLE IF NOT EXISTS agents (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'offline',
  description   TEXT NOT NULL DEFAULT '',
  uptime        REAL NOT NULL DEFAULT 0,
  task_count    INTEGER NOT NULL DEFAULT 0,
  success_rate  REAL NOT NULL DEFAULT 0,
  last_heartbeat TEXT,
  reflex_level  INTEGER NOT NULL DEFAULT 0,
  config        TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sub_agents (
  id              TEXT PRIMARY KEY,
  parent_id       TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'offline',
  spawned_at      TEXT NOT NULL DEFAULT (datetime('now')),
  task_description TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_sub_agents_parent ON sub_agents(parent_id);

-- ========== 任务域 ==========

CREATE TABLE IF NOT EXISTS tasks (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending',
  priority        TEXT NOT NULL DEFAULT 'medium',
  assigned_agents TEXT NOT NULL DEFAULT '[]',
  output          TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT
);

CREATE TABLE IF NOT EXISTS task_steps (
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

CREATE INDEX IF NOT EXISTS idx_task_steps_task ON task_steps(task_id);

-- ========== 风险域 ==========

CREATE TABLE IF NOT EXISTS risk_events (
  id              TEXT PRIMARY KEY,
  level           TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL DEFAULT '',
  timestamp       TEXT NOT NULL DEFAULT (datetime('now')),
  resolved        INTEGER NOT NULL DEFAULT 0,
  resolved_at     TEXT,
  actions         TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS risk_isolation (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  label           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  checked         INTEGER NOT NULL DEFAULT 0
);

-- ========== 记忆域 ==========

CREATE TABLE IF NOT EXISTS memory_entries (
  id              TEXT PRIMARY KEY,
  zone            TEXT NOT NULL,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  type            TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  verified        INTEGER NOT NULL DEFAULT 0,
  tags            TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== 进化域 ==========

CREATE TABLE IF NOT EXISTS evolution_records (
  id              TEXT PRIMARY KEY,
  stage           TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  agent_id        TEXT NOT NULL,
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT,
  status          TEXT NOT NULL DEFAULT 'in_progress',
  metrics         TEXT,
  before_metrics  TEXT
);

-- ========== 工作流: 选品 ==========

CREATE TABLE IF NOT EXISTS wf_data_sources (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  enabled         INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'pending',
  progress        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wf_product_keywords (
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

CREATE TABLE IF NOT EXISTS wf_pain_points (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  category        TEXT NOT NULL,
  count           INTEGER NOT NULL DEFAULT 0,
  pct             REAL NOT NULL DEFAULT 0,
  examples        TEXT NOT NULL DEFAULT '[]'
);

-- ========== 工作流: AI制图 ==========

CREATE TABLE IF NOT EXISTS wf_generated_images (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS wf_storyboard_frames (
  id              TEXT PRIMARY KEY,
  description     TEXT NOT NULL,
  duration        TEXT NOT NULL,
  script          TEXT NOT NULL DEFAULT '',
  camera          TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0
);

-- ========== 工作流: 广告 ==========

CREATE TABLE IF NOT EXISTS wf_ad_keywords (
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

CREATE TABLE IF NOT EXISTS wf_ad_positions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  position        TEXT NOT NULL,
  share           REAL NOT NULL DEFAULT 0,
  trend           TEXT NOT NULL DEFAULT '[]'
);

-- ========== 工作流: 商品发布 ==========

CREATE TABLE IF NOT EXISTS wf_categories (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  confidence      REAL NOT NULL DEFAULT 0,
  reason          TEXT NOT NULL DEFAULT '',
  bsr             INTEGER NOT NULL DEFAULT 0,
  fee             REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wf_bullet_points (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  seo_score       INTEGER NOT NULL DEFAULT 0,
  rufus           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wf_infringement_words (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  word            TEXT NOT NULL,
  type            TEXT NOT NULL,
  risk            TEXT NOT NULL DEFAULT '',
  action          TEXT NOT NULL DEFAULT ''
);

-- ========== 工作流: 库存 ==========

CREATE TABLE IF NOT EXISTS wf_inventory (
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

-- ========== 工作流: 生成结果 ==========

CREATE TABLE IF NOT EXISTS wf_generated_listings (
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

CREATE TABLE IF NOT EXISTS wf_generated_research (
  id              TEXT PRIMARY KEY,
  marketplace     TEXT NOT NULL DEFAULT 'US',
  category        TEXT NOT NULL DEFAULT '',
  keywords        TEXT NOT NULL DEFAULT '[]',
  sources         TEXT NOT NULL DEFAULT '[]',
  result_json     TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wf_generated_competitor_analysis (
  id              TEXT PRIMARY KEY,
  asins           TEXT NOT NULL DEFAULT '[]',
  marketplace     TEXT NOT NULL DEFAULT 'US',
  keywords        TEXT NOT NULL DEFAULT '[]',
  result_json     TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wf_restock_orders (
  id              TEXT PRIMARY KEY,
  items           TEXT NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'created',
  total_items     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wf_workflow_statuses (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  href            TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'idle',
  last_run        TEXT,
  run_count       INTEGER NOT NULL DEFAULT 0,
  success_rate    REAL NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wf_ad_analyses (
  id              TEXT PRIMARY KEY,
  keyword         TEXT NOT NULL DEFAULT '',
  current_data    TEXT NOT NULL DEFAULT '{}',
  result_json     TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== 工作流: 竞品分析 ==========

CREATE TABLE IF NOT EXISTS wf_competitors (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  sp_count        INTEGER NOT NULL DEFAULT 0,
  sb_count        INTEGER NOT NULL DEFAULT 0,
  sd_count        INTEGER NOT NULL DEFAULT 0,
  keywords        INTEGER NOT NULL DEFAULT 0,
  rank            INTEGER NOT NULL DEFAULT 0,
  strategy        TEXT NOT NULL DEFAULT 'complementary'
);

CREATE TABLE IF NOT EXISTS wf_competitor_keywords (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword         TEXT NOT NULL,
  volume          INTEGER NOT NULL DEFAULT 0,
  competition     REAL NOT NULL DEFAULT 0,
  cpc             REAL NOT NULL DEFAULT 0,
  trend           TEXT NOT NULL DEFAULT '[]',
  type            TEXT NOT NULL DEFAULT 'core'
);

-- ========== Agent 生命系统 ==========

CREATE TABLE IF NOT EXISTS agent_journal (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'thought',
  content         TEXT NOT NULL,
  context         TEXT NOT NULL DEFAULT '{}',
  mood_at         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_journal_agent ON agent_journal(agent_id, created_at);

-- ========== RAK 引擎 ==========

CREATE TABLE IF NOT EXISTS rak_messages (
  id              TEXT PRIMARY KEY,
  from_agent      TEXT NOT NULL,
  to_agent        TEXT NOT NULL,
  type            TEXT NOT NULL,
  protocol        TEXT NOT NULL DEFAULT 'rak-v1',
  payload         TEXT NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at    TEXT,
  ttl             INTEGER NOT NULL DEFAULT 30000
);

CREATE TABLE IF NOT EXISTS rak_conflicts (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL,
  agents          TEXT NOT NULL DEFAULT '[]',
  conflict_type   TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  resolution      TEXT,
  resolved_at     TEXT,
  result          TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rak_consensus_log (
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

CREATE TABLE IF NOT EXISTS rak_dag_nodes (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'task',
  status          TEXT NOT NULL DEFAULT 'pending',
  assigned_agent  TEXT,
  dependencies    TEXT NOT NULL DEFAULT '[]',
  config          TEXT NOT NULL DEFAULT '{}',
  result          TEXT,
  started_at      TEXT,
  completed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_rak_messages_to ON rak_messages(to_agent);
CREATE INDEX IF NOT EXISTS idx_rak_messages_status ON rak_messages(status);
CREATE INDEX IF NOT EXISTS idx_rak_conflicts_task ON rak_conflicts(task_id);
CREATE INDEX IF NOT EXISTS idx_rak_dag_task ON rak_dag_nodes(task_id);

-- ========== AI 配置 ==========

CREATE TABLE IF NOT EXISTS ai_config (
  key             TEXT PRIMARY KEY,
  value           TEXT NOT NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ========== 爬虫数据 ==========

CREATE TABLE IF NOT EXISTS crawl_results (
  id              TEXT PRIMARY KEY,
  store_id        TEXT NOT NULL,
  store_name      TEXT NOT NULL DEFAULT '',
  platform        TEXT NOT NULL DEFAULT '',
  url             TEXT NOT NULL DEFAULT '',
  data            TEXT NOT NULL DEFAULT '{}',
  timestamp       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_crawl_store ON crawl_results(store_id);
CREATE INDEX IF NOT EXISTS idx_crawl_time ON crawl_results(timestamp);
`;
