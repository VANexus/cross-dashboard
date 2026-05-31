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

    // Seed workflow statuses if table is empty (new table migration)
    const wsCount = _db.exec("SELECT COUNT(*) as c FROM wf_workflow_statuses");
    if ((wsCount[0]?.values[0]?.[0] as number ?? 0) === 0) {
      const statuses = [
        ["product-research", "选品工作流", "/workflows/product-research", "idle"],
        ["ai-imaging", "AI 作图", "/workflows/ai-imaging", "idle"],
        ["ai-advertising", "AI 广告", "/workflows/ai-advertising", "idle"],
        ["ai-listing", "AI 上架", "/workflows/ai-listing", "idle"],
        ["inventory", "库销比", "/workflows/inventory", "idle"],
        ["competitor-ads", "竞品广告分析", "/workflows/competitor-ads", "idle"],
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
