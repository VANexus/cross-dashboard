/**
 * FlowMind RAK — Database singleton
 * sql.js (pure JavaScript SQLite), works in both Bun and Node.js
 * Wraps sql.js with bun:sqlite-compatible API via CompatDatabase
 */
import initSqlJs from "sql.js";
import { CompatDatabase } from "./compat";
import { SCHEMA_SQL } from "./schema";
import { seedDatabase } from "./seed";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

// Resolve WASM file path for sql.js in production builds
const WASM_PATH = join(/*turbopackIgnore: true*/ process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");

const DB_PATH = process.env.RAK_DB_PATH ?? "./data/flowmind.db";

let _db: CompatDatabase | null = null;
let _initPromise: Promise<CompatDatabase> | null = null;

/** Get or create the database instance (async, initializes sql.js) */
export async function getDbAsync(): Promise<CompatDatabase> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: () => WASM_PATH,
    });

    const dir = dirname(DB_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    // Load existing DB file or create new
    let rawDb;
    if (existsSync(DB_PATH)) {
      const buffer = readFileSync(DB_PATH);
      rawDb = new SQL.Database(buffer);
    } else {
      rawDb = new SQL.Database();
    }

    _db = new CompatDatabase(rawDb);

    // Enable WAL mode and foreign keys
    _db.exec("PRAGMA journal_mode = WAL");
    _db.exec("PRAGMA foreign_keys = ON");
    _db.exec("PRAGMA busy_timeout = 5000");

    // Initialize schema
    _db.exec(SCHEMA_SQL);

    // Seed if empty (first run)
    const result = _db.exec("SELECT COUNT(*) as c FROM agents");
    const count = result[0]?.values[0]?.[0] as number ?? 0;
    if (count === 0) {
      seedDatabase(_db.raw);
    }

    // Ensure demo_mode exists in existing DBs (lightweight migration)
    _db.run(
      "INSERT INTO ai_config (key, value) SELECT 'demo_mode', 'false' WHERE NOT EXISTS (SELECT 1 FROM ai_config WHERE key = 'demo_mode')"
    );

    // 去电商化迁移：移除旧跨境电商工作流状态
    _db.run(
      "DELETE FROM wf_workflow_statuses WHERE id IN ('product-research','ai-imaging','ai-advertising','ai-listing','inventory','competitor-ads')"
    );

    // Seed content-module statuses if table is empty (new table migration)
    const wsCount = _db.exec("SELECT COUNT(*) as c FROM wf_workflow_statuses");
    if ((wsCount[0]?.values[0]?.[0] as number ?? 0) === 0) {
      const statuses = [
        ["copywriting", "文案创作", "/content-studio", "running"],
        ["compliance-audit", "合规审计", "/content-studio", "idle"],
        ["image-gen", "AI 配图", "/content-studio", "idle"],
        ["idea-design", "思路设计", "/content-studio", "idle"],
        ["hot-topic", "热点雷达", "/content-studio", "idle"],
      ];
      const stmt = _db.prepare("INSERT OR IGNORE INTO wf_workflow_statuses (id, name, href, status) VALUES (?, ?, ?, ?)");
      for (const s of statuses) stmt.run(s[0], s[1], s[2], s[3]);
    }

    // Add url column to wf_generated_images if missing (migration)
    try {
      _db.run("ALTER TABLE wf_generated_images ADD COLUMN url TEXT NOT NULL DEFAULT ''");
    } catch { /* column already exists */ }
    try {
      _db.run("ALTER TABLE wf_generated_images ADD COLUMN revised_prompt TEXT");
    } catch { /* column already exists */ }

    // Agent Life System migration: add agent_id to memory_entries
    try {
      _db.run("ALTER TABLE memory_entries ADD COLUMN agent_id TEXT");
      _db.run("CREATE INDEX IF NOT EXISTS idx_memory_agent ON memory_entries(agent_id)");
    } catch {
      // Column already exists — ignore
    }

    // Ensure wf_ad_analyses table exists (migration for existing DBs)
    _db.exec(`CREATE TABLE IF NOT EXISTS wf_ad_analyses (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL DEFAULT '',
      current_data TEXT NOT NULL DEFAULT '{}',
      result_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

    // Ensure wf_restock_orders table exists (migration for existing DBs)
    _db.exec(`CREATE TABLE IF NOT EXISTS wf_restock_orders (
      id TEXT PRIMARY KEY,
      items TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'created',
      total_items INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

    // Ensure wf_localize_tasks table exists (migration for existing DBs)
    _db.exec(`CREATE TABLE IF NOT EXISTS wf_localize_tasks (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL DEFAULT '',
      video_path TEXT NOT NULL,
      target_lang TEXT NOT NULL DEFAULT 'en',
      source_lang TEXT NOT NULL DEFAULT 'zh',
      enable_tts INTEGER NOT NULL DEFAULT 1,
      remove_subtitles INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'queued',
      outputs TEXT NOT NULL DEFAULT '{}',
      error TEXT,
      created_at TEXT,
      started_at TEXT,
      finished_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    _db.exec("CREATE INDEX IF NOT EXISTS idx_localize_batch ON wf_localize_tasks(batch_id)");

    // Seed demo localize tasks if table is empty (so the page renders without VL)
    const lzCount = _db.exec("SELECT COUNT(*) as c FROM wf_localize_tasks");
    if ((lzCount[0]?.values[0]?.[0] as number ?? 0) === 0) {
      const demo = [
        ["lt-demo-001", "batch-demo-001", "https://cdn.example.com/videos/car-launch-zh.mp4", "en", "zh", 1, 1, "completed", '{"localized.mp4": "/outputs/lt-demo-001/localized.mp4", "subs.ass": "/outputs/lt-demo-001/subs.ass"}', null, "2026-08-25 09:12:00", "2026-08-25 09:12:03", "2026-08-25 09:14:41"],
        ["lt-demo-002", "batch-demo-001", "https://cdn.example.com/videos/product-demo-zh.mp4", "en", "zh", 1, 1, "completed", '{"localized.mp4": "/outputs/lt-demo-002/localized.mp4"}', null, "2026-08-25 09:12:00", "2026-08-25 09:12:03", "2026-08-25 09:15:02"],
        ["lt-demo-003", "batch-demo-002", "https://cdn.example.com/videos/brand-story-zh.mp4", "th", "zh", 1, 1, "failed", "{}", "ASR 未识别到语音（可能无人声）", "2026-08-25 14:30:00", "2026-08-25 14:30:02", "2026-08-25 14:30:11"],
        ["lt-demo-004", "batch-demo-002", "https://cdn.example.com/videos/feature-tour-zh.mp4", "th", "zh", 1, 1, "running", "{}", null, "2026-08-25 14:30:00", "2026-08-25 14:30:02", null],
        ["lt-demo-005", "batch-demo-003", "https://cdn.example.com/videos/teaser-zh.mp4", "ja", "zh", 0, 1, "queued", "{}", null, "2026-08-26 08:05:00", null, null],
        ["lt-demo-006", "batch-demo-003", "https://cdn.example.com/videos/interview-zh.mp4", "ja", "zh", 0, 1, "cancelled", "{}", null, "2026-08-26 08:05:00", "2026-08-26 08:05:02", "2026-08-26 08:06:40"],
      ];
      const stmt = _db.prepare(
        `INSERT OR IGNORE INTO wf_localize_tasks
          (id, batch_id, video_path, target_lang, source_lang, enable_tts, remove_subtitles, status, outputs, error, created_at, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const t of demo) stmt.run(...(t as any[]));
    }

    // Ensure video-localization workflow status exists (unconditional, for existing DBs)
    _db.run(
      "INSERT OR IGNORE INTO wf_workflow_statuses (id, name, href, status) VALUES ('video-localization', '视频本地化', '/workflows/video-localization', 'running')"
    );

    // ════════ 内容创作中心迁移（wf_content_*）════════
    _db.exec(`CREATE TABLE IF NOT EXISTS wf_content_rules (
      id TEXT PRIMARY KEY, platform TEXT NOT NULL DEFAULT '*',
      category TEXT NOT NULL DEFAULT 'advert', severity TEXT NOT NULL DEFAULT 'warning',
      pattern TEXT NOT NULL DEFAULT '', label TEXT NOT NULL DEFAULT '',
      suggestion TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    _db.exec("CREATE INDEX IF NOT EXISTS idx_content_rules_platform ON wf_content_rules(platform)");

    _db.exec(`CREATE TABLE IF NOT EXISTS wf_content_hot_topics (
      id TEXT PRIMARY KEY, platform TEXT NOT NULL, word TEXT NOT NULL,
      heat INTEGER NOT NULL DEFAULT 0, delta INTEGER, url TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '', fetched_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    _db.exec("CREATE INDEX IF NOT EXISTS idx_content_hot_platform ON wf_content_hot_topics(platform, fetched_at)");

    _db.exec(`CREATE TABLE IF NOT EXISTS wf_content_ideas (
      id TEXT PRIMARY KEY, platform TEXT NOT NULL, angle TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    _db.exec("CREATE INDEX IF NOT EXISTS idx_content_ideas_platform ON wf_content_ideas(platform)");

    _db.exec(`CREATE TABLE IF NOT EXISTS wf_content_drafts (
      id TEXT PRIMARY KEY, platform TEXT NOT NULL, title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft', audit_passed INTEGER NOT NULL DEFAULT 0,
      audit_result TEXT NOT NULL DEFAULT '{}', image_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    _db.exec("CREATE INDEX IF NOT EXISTS idx_content_drafts_platform ON wf_content_drafts(platform)");

    // wf_generated_images 挂接内容创作：加 platform / draft_id 列（try/catch 幂等）
    try { _db.run("ALTER TABLE wf_generated_images ADD COLUMN platform TEXT NOT NULL DEFAULT ''"); } catch { /* exists */ }
    try { _db.run("ALTER TABLE wf_generated_images ADD COLUMN draft_id TEXT NOT NULL DEFAULT ''"); } catch { /* exists */ }

    // 种子：规则库（仅表空时；与 rak-flowmind _content_rules 对齐，用于 UI 展示）
    const ruleCount = _db.exec("SELECT COUNT(*) as c FROM wf_content_rules");
    if ((ruleCount[0]?.values[0]?.[0] as number ?? 0) === 0) {
      const rules: Array<[string, string, string, string, string, string, string]> = [
        ["R-ABS-01", "*", "absolute", "error", "全网最低|全国最低|顶级|唯一|首选|100%|百分百|绝对|极致|最强|第一品牌", "检出绝对化用语", "删除或改为可证实的具体表述"],
        ["R-MED-01", "*", "medical", "error", "治疗|治愈|根治|降血压|抗癌|疗效|包治百病", "检出医疗功效宣称", "删除疾病治疗/保健功能表述"],
        ["R-DAT-01", "*", "data", "warning", "央视(报道|上榜|推荐)|荣获", "奖项/媒体报道建议补充来源", "补充权威来源或删除未证实头衔"],
        ["R-XHS-01", "xhs", "platform", "error", "加微信|微信号|VX|薇信|私信(我|领|获取)", "小红书禁止站外导流", "改为'点我了解'或在平台内互动"],
        ["R-XHS-02", "xhs", "platform", "warning", "tb.cn|复制.*打开(淘宝|天猫)", "疑似站外商品链接引导", "删除站外链接"],
        ["R-XHS-03", "xhs", "advert", "warning", "刷单|买粉|代购|代发", "检出违规营销词", "删除与刷单/买粉相关的表述"],
        ["R-WX-01", "wechat", "platform", "error", "转发(到|至)?(朋友圈|群|好友)|转发抽奖|助力|砍价", "诱导分享/转发", "删除强制转发要求"],
        ["R-WX-02", "wechat", "platform", "warning", "关注(才|才能|后|即可)|不(关注|点)就", "诱导关注", "用内容价值吸引关注"],
        ["R-DY-01", "douyin", "finance", "error", "稳赚不赔|保本保息|零风险|暴富|躺赚|轻松月入", "检出金融收益承诺", "删除收益承诺；金融需资质并提示风险"],
        ["R-DY-02", "douyin", "platform", "error", "加微信|VX|私信(我|领|获取)", "抖音导流/引导话术", "在平台规则内完成转化"],
        ["R-PLT-01", "*", "platform", "warning", "wechat|vx|v信|加我微信|二维码", "检出联系方式引导", "确认平台是否允许展示"],
      ];
      const ruleStmt = _db.prepare(
        "INSERT OR IGNORE INTO wf_content_rules (id, platform, category, severity, pattern, label, suggestion) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      for (const r of rules) ruleStmt.run(...r);
    }

    // 种子：热点兜底（仅表空时；供 UI 首次渲染 + API 不可达时展示）
    const hotCount = _db.exec("SELECT COUNT(*) as c FROM wf_content_hot_topics");
    if ((hotCount[0]?.values[0]?.[0] as number ?? 0) === 0) {
      const seedHot: Array<[string, string, string, number, number | null, string]> = [
        ["ht-xhs-1", "xhs", "通勤好物", 920, 12, "seed"],
        ["ht-xhs-2", "xhs", "办公室神器", 870, 8, "seed"],
        ["ht-xhs-3", "xhs", "夏日降温", 810, 21, "seed"],
        ["ht-xhs-4", "xhs", "极简生活", 680, 5, "seed"],
        ["ht-xhs-5", "xhs", "车载必备", 740, -3, "seed"],
        ["ht-wx-1", "wechat", "品牌内容", 780, 6, "seed"],
        ["ht-wx-2", "wechat", "产品方法论", 710, 4, "seed"],
        ["ht-wx-3", "wechat", "内容营销", 660, -2, "seed"],
        ["ht-wx-4", "wechat", "消费洞察", 590, 9, "seed"],
        ["ht-wx-5", "wechat", "行业趋势", 540, 3, "seed"],
        ["ht-dy-1", "douyin", "好物分享", 880, 15, "seed"],
        ["ht-dy-2", "douyin", "通勤", 760, 7, "seed"],
        ["ht-dy-3", "douyin", "夏日好物", 700, 11, "seed"],
        ["ht-dy-4", "douyin", "开箱实测", 640, -1, "seed"],
        ["ht-dy-5", "douyin", "车载好物", 620, 4, "seed"],
      ];
      const hotStmt = _db.prepare(
        "INSERT OR IGNORE INTO wf_content_hot_topics (id, platform, word, heat, delta, source, fetched_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
      );
      for (const h of seedHot) hotStmt.run(...h);
    }

    // Sync AI config from environment variables (allows .env.local to override DB values)
    syncAIConfigFromEnv(_db);

    // Persist to disk
    saveToDisk(_db);

    // Start agent runtime (fire-and-forget, only on first init)
    import("../agent-runtime/runtime").then(({ agentRuntime }) => agentRuntime.start());

    return _db;
  })();

  return _initPromise;
}

/** Synchronous access — only works after getDbAsync() has been called */
export function getDb(): CompatDatabase {
  if (!_db) {
    throw new Error("Database not initialized. Call getDbAsync() first.");
  }
  return _db;
}

/** Check if database is initialized */
export function isDbReady(): boolean {
  return _db !== null;
}

/** Save database to disk */
function saveToDisk(db: CompatDatabase): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(DB_PATH, buffer);
}

/** Persist and close the database connection */
export function closeDb(): void {
  if (_db) {
    saveToDisk(_db);
    _db.close();
    _db = null;
    _initPromise = null;
  }
}

/** Sync AI configuration from environment variables to database */
function syncAIConfigFromEnv(db: CompatDatabase): void {
  const envConfigs: Record<string, string | undefined> = {
    provider: process.env.AI_PROVIDER,
    model: process.env.AI_MODEL,
    base_url: process.env.AI_BASE_URL,
    api_key: process.env.AI_API_KEY,
    max_tokens: process.env.AI_MAX_TOKENS,
    temperature: process.env.AI_TEMPERATURE,
    demo_mode: process.env.AI_DEMO_MODE,
  };

  const stmt = db.prepare(
    "INSERT INTO ai_config (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  );

  for (const [key, value] of Object.entries(envConfigs)) {
    if (value !== undefined) {
      stmt.run(key, value);
    }
  }
}
