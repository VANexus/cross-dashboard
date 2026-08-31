-- ============================================================
-- 00001_init_schema.sql
-- FlowMind RAK — Supabase PostgreSQL Initial Schema
-- Translated from cross-dashboard/lib/db/schema.ts (SCHEMA_SQL) + inlined CREATE TABLEs in db/index.ts
-- Note: TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS') keeps SQLite compatibility.
-- ============================================================

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
  created_at    TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at    TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS sub_agents (
  id              TEXT PRIMARY KEY,
  parent_id       TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'offline',
  spawned_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
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
  created_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
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
  timestamp       TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  resolved        INTEGER NOT NULL DEFAULT 0,
  resolved_at     TEXT,
  actions         TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS risk_isolation (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
  agent_id        TEXT,
  created_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_memory_agent ON memory_entries(agent_id);

-- ========== 进化域 ==========

CREATE TABLE IF NOT EXISTS evolution_records (
  id              TEXT PRIMARY KEY,
  stage           TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  agent_id        TEXT NOT NULL,
  started_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
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
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
  platform        TEXT NOT NULL DEFAULT '',
  draft_id        TEXT NOT NULL DEFAULT '',
  clip_score      REAL NOT NULL DEFAULT 0,
  ctr_score       REAL NOT NULL DEFAULT 0,
  overall         REAL NOT NULL DEFAULT 0,
  is_best         INTEGER NOT NULL DEFAULT 0,
  prompt          TEXT NOT NULL DEFAULT '',
  model           TEXT NOT NULL DEFAULT '',
  seed            INTEGER NOT NULL DEFAULT 0,
  revised_prompt  TEXT,
  created_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
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
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
  created_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS wf_generated_research (
  id              TEXT PRIMARY KEY,
  marketplace     TEXT NOT NULL DEFAULT 'US',
  category        TEXT NOT NULL DEFAULT '',
  keywords        TEXT NOT NULL DEFAULT '[]',
  sources         TEXT NOT NULL DEFAULT '[]',
  result_json     TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS wf_generated_competitor_analysis (
  id              TEXT PRIMARY KEY,
  asins           TEXT NOT NULL DEFAULT '[]',
  marketplace     TEXT NOT NULL DEFAULT 'US',
  keywords        TEXT NOT NULL DEFAULT '[]',
  result_json     TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS wf_restock_orders (
  id              TEXT PRIMARY KEY,
  items           TEXT NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'created',
  total_items     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS wf_workflow_statuses (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  href            TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'idle',
  last_run        TEXT,
  run_count       INTEGER NOT NULL DEFAULT 0,
  success_rate    REAL NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS wf_ad_analyses (
  id              TEXT PRIMARY KEY,
  keyword         TEXT NOT NULL DEFAULT '',
  current_data    TEXT NOT NULL DEFAULT '{}',
  result_json     TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
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
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
  created_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
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
  created_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
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
  created_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS rak_consensus_log (
  id              TEXT PRIMARY KEY,
  proposal_id     TEXT NOT NULL,
  proposer        TEXT NOT NULL,
  voters          TEXT NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'pending',
  threshold       REAL NOT NULL DEFAULT 0.67,
  result          TEXT,
  created_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
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
  updated_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

-- ========== 爬虫数据 ==========

CREATE TABLE IF NOT EXISTS crawl_results (
  id              TEXT PRIMARY KEY,
  store_id        TEXT NOT NULL,
  store_name      TEXT NOT NULL DEFAULT '',
  platform        TEXT NOT NULL DEFAULT '',
  url             TEXT NOT NULL DEFAULT '',
  data            TEXT NOT NULL DEFAULT '{}',
  timestamp       TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_crawl_store ON crawl_results(store_id);
CREATE INDEX IF NOT EXISTS idx_crawl_time ON crawl_results(timestamp);

-- ========== 工作流: 视频本地化 ==========

CREATE TABLE IF NOT EXISTS wf_localize_tasks (
  id               TEXT PRIMARY KEY,
  batch_id         TEXT NOT NULL DEFAULT '',
  video_path       TEXT NOT NULL,
  target_lang      TEXT NOT NULL DEFAULT 'en',
  source_lang      TEXT NOT NULL DEFAULT 'zh',
  enable_tts       INTEGER NOT NULL DEFAULT 1,
  remove_subtitles INTEGER NOT NULL DEFAULT 1,
  status           TEXT NOT NULL DEFAULT 'queued',
  outputs          TEXT NOT NULL DEFAULT '{}',
  error            TEXT,
  created_at       TEXT,
  started_at       TEXT,
  finished_at      TEXT,
  updated_at       TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_localize_batch ON wf_localize_tasks(batch_id);

-- ========== 工作流: 内容创作中心 ==========

CREATE TABLE IF NOT EXISTS wf_content_rules (
  id               TEXT PRIMARY KEY,
  platform         TEXT NOT NULL DEFAULT '*',
  category         TEXT NOT NULL DEFAULT 'advert',
  severity         TEXT NOT NULL DEFAULT 'warning',
  pattern          TEXT NOT NULL DEFAULT '',
  label            TEXT NOT NULL DEFAULT '',
  suggestion       TEXT NOT NULL DEFAULT '',
  enabled          INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_content_rules_platform ON wf_content_rules(platform);

CREATE TABLE IF NOT EXISTS wf_content_hot_topics (
  id               TEXT PRIMARY KEY,
  platform         TEXT NOT NULL,
  word             TEXT NOT NULL,
  heat             INTEGER NOT NULL DEFAULT 0,
  delta            INTEGER,
  url              TEXT NOT NULL DEFAULT '',
  source           TEXT NOT NULL DEFAULT '',
  fetched_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_content_hot_platform ON wf_content_hot_topics(platform, fetched_at);

CREATE TABLE IF NOT EXISTS wf_content_ideas (
  id               TEXT PRIMARY KEY,
  platform         TEXT NOT NULL,
  angle            TEXT NOT NULL DEFAULT '',
  title            TEXT NOT NULL,
  subject          TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_content_ideas_platform ON wf_content_ideas(platform);

CREATE TABLE IF NOT EXISTS wf_content_drafts (
  id               TEXT PRIMARY KEY,
  platform         TEXT NOT NULL,
  title            TEXT NOT NULL DEFAULT '',
  body             TEXT NOT NULL DEFAULT '',
  tags             TEXT NOT NULL DEFAULT '[]',
  status           TEXT NOT NULL DEFAULT 'draft',
  audit_passed     INTEGER NOT NULL DEFAULT 0,
  audit_result     TEXT NOT NULL DEFAULT '{}',
  image_count      INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at       TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_content_drafts_platform ON wf_content_drafts(platform);

-- ========== 工作流: B端运营工作台 ==========

CREATE TABLE IF NOT EXISTS wf_keyword_trends (
  id               TEXT PRIMARY KEY,
  platform         TEXT NOT NULL,
  industry_id      TEXT NOT NULL DEFAULT '',
  word             TEXT NOT NULL,
  heat             INTEGER NOT NULL DEFAULT 0,
  delta            INTEGER,
  rank             INTEGER NOT NULL DEFAULT 0,
  industry         TEXT NOT NULL DEFAULT '通用',
  source           TEXT NOT NULL DEFAULT '',
  fetched_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_keyword_trends_platform ON wf_keyword_trends(platform, fetched_at);

CREATE TABLE IF NOT EXISTS wf_longtail_keywords (
  id               TEXT PRIMARY KEY,
  industry         TEXT NOT NULL,
  word             TEXT NOT NULL,
  category         TEXT NOT NULL DEFAULT '',
  search_intent    TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_longtail_industry ON wf_longtail_keywords(industry);

CREATE TABLE IF NOT EXISTS wf_b2b_products (
  id               TEXT PRIMARY KEY,
  product_id       TEXT NOT NULL,
  subject          TEXT NOT NULL,
  keywords         TEXT NOT NULL DEFAULT '[]',
  image_url        TEXT NOT NULL DEFAULT '',
  price            TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'onSelling',
  fetched_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS wf_b2b_listings (
  id                 TEXT PRIMARY KEY,
  product_id         TEXT NOT NULL,
  preference         TEXT NOT NULL DEFAULT 'alibaba',
  title              TEXT NOT NULL DEFAULT '',
  description        TEXT NOT NULL DEFAULT '',
  keywords           TEXT NOT NULL DEFAULT '[]',
  image_url          TEXT NOT NULL DEFAULT '',
  image_prompt       TEXT NOT NULL DEFAULT '',
  upload_status      TEXT NOT NULL DEFAULT 'draft',
  uploaded_product_id TEXT NOT NULL DEFAULT '',
  created_at         TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS wf_image_skills (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  cover_url        TEXT NOT NULL DEFAULT '',
  reversed_prompt  TEXT NOT NULL DEFAULT '',
  style_tags       TEXT NOT NULL DEFAULT '[]',
  aspect_ratio     TEXT NOT NULL DEFAULT '1:1',
  platform         TEXT NOT NULL DEFAULT 'generic',
  usage_count      INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at       TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
