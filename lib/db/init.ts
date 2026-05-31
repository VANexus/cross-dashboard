/**
 * FlowMind RAK — Database auto-initialization
 * Import this module at the top of API routes to ensure the DB is ready.
 *
 * Usage in API route:
 *   import "@/lib/db/init";
 *   import { getDb } from "@/lib/db";
 */
import { getDbAsync } from "./index";

// Start initialization immediately on module load.
// The promise is cached inside getDbAsync(), so subsequent calls are instant.
const _ready = getDbAsync();

/** Await this to guarantee the database is ready */
export async function ensureDb() {
  await _ready;
}
