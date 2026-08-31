/**
 * FlowMind RAK — Database singleton (Supabase PostgreSQL)
 * Replaces sql.js + WASM.
 * Exports:
 *   - getSupabase()  -> raw SupabaseClient (RECOMMENDED for new code)
 *   - getDb() / getDbAsync() -> CompatDatabase wrapper (legacy API, used by repositories)
 *   - isDbReady()
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CompatDatabase } from "./compat";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://xbdznkpdtlysvbcoptyw.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiZHpua3BkdGx5c3ZiY29wdHl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNjc1MjEsImV4cCI6MjEwMzc0MzUyMX0.NQhag4RoS8qGJ7CRLs9Nm9PvovnpMot6WTKdnfxhgEI";

let _supabase: SupabaseClient | null = null;
let _compat: CompatDatabase | null = null;
let _initPromise: Promise<void> | null = null;

/** Get the raw Supabase client — use this for new code. */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: {
        headers: { "X-Client-Info": "flowmind-cross-dashboard" },
      },
    });
  }
  return _supabase;
}

/** Async init (keeps signature from sql.js era). */
export async function getDbAsync(): Promise<CompatDatabase> {
  if (_compat) return _compat;
  if (_initPromise) {
    await _initPromise;
    return _compat!;
  }
  _initPromise = (async () => {
    const sb = getSupabase();
    _compat = new CompatDatabase(sb);

    // Sync AI config keys from environment variables
    syncAIConfigFromEnv(sb);

    // B端 workflow statuses (idempotent — if they already exist, do nothing)
    await ensureWorkflowStatuses(sb);

    // Start agent runtime (fire-and-forget, only on first init)
    import("../agent-runtime/runtime")
      .then(({ agentRuntime }) => agentRuntime.start())
      .catch((e) => console.warn("[db] agentRuntime start failed", e.message));
  })();
  await _initPromise;
  return _compat!;
}

/** Synchronous access — only works after getDbAsync() has been called. */
export function getDb(): CompatDatabase {
  if (!_compat) {
    throw new Error("Database not initialized. Call getDbAsync() first.");
  }
  return _compat;
}

export function isDbReady(): boolean {
  return _compat !== null;
}

/** Close / reset (no disk flush needed for Supabase — just release compat ref). */
export function closeDb(): void {
  _supabase = null;
  _compat = null;
  _initPromise = null;
}

/** Legacy export name (was saveToDisk in sql.js days; now no-op). */
export function saveToDisk(): void {
  /* no-op: Supabase is persisted server-side */
}

// ── helpers ────────────────────────────────────────────────────────────────

function syncAIConfigFromEnv(sb: SupabaseClient): void {
  const envConfigs: Record<string, string | undefined> = {
    provider: process.env.AI_PROVIDER,
    model: process.env.AI_MODEL,
    base_url: process.env.AI_BASE_URL,
    api_key: process.env.AI_API_KEY,
    max_tokens: process.env.AI_MAX_TOKENS,
    temperature: process.env.AI_TEMPERATURE,
  };

  const rows = Object.entries(envConfigs)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => ({ key, value }));

  if (rows.length === 0) return;

  // Fire-and-forget upsert
  Promise.resolve(sb.from("ai_config").upsert(rows, { onConflict: "key" }))
    .then(() => {})
    .catch((e: unknown) =>
      console.warn("[db] syncAIConfigFromEnv upsert failed", e instanceof Error ? e.message : e)
    );
}

async function ensureWorkflowStatuses(sb: SupabaseClient): Promise<void> {
  const defaults: Array<[string, string, string, string]> = [
    ["keyword-trend", "关键词趋势", "/b2b/keyword-trends", "idle"],
    ["b2b-listing", "货品一键上架", "/b2b/listing", "idle"],
    ["image-skill", "生图 Skill 库", "/b2b/image-skills", "idle"],
    ["copywriting", "文案创作", "/content-studio", "running"],
    ["compliance-audit", "合规审计", "/content-studio", "idle"],
    ["image-gen", "AI 配图", "/content-studio", "idle"],
    ["idea-design", "思路设计", "/content-studio", "idle"],
    ["hot-topic", "热点雷达", "/content-studio", "idle"],
    [
      "video-localization",
      "视频本地化",
      "/workflows/video-localization",
      "running",
    ],
  ];
  try {
    await sb
      .from("wf_workflow_statuses")
      .upsert(
        defaults.map(([id, name, href, status]) => ({ id, name, href, status })),
        { onConflict: "id", ignoreDuplicates: true }
      );
  } catch (e) {
    console.warn("[db] ensureWorkflowStatuses failed:", (e as Error).message);
  }
}
