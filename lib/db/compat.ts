/**
 * FlowMind RAK — Supabase compatibility layer.
 *
 * ATTENTION: This is a thin transitional wrapper.
 * New code and repositories should call getSupabase() directly and use the
 * Supabase query builder API (from/select/eq/insert/upsert/range/order ...).
 *
 * Repository files that still use the legacy `db.query(sql).all(params)` style
 * MUST be rewritten. When such a legacy call path is hit, this wrapper will
 * throw a descriptive error naming the SQL so we can identify and migrate it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

interface QueryResult {
  get(...params: unknown[]): Record<string, unknown> | null;
  all(...params: unknown[]): Array<Record<string, unknown>>;
}

interface CompatStatement {
  run(...params: unknown[]): void;
  free(): void;
}

function legacyNotRewritten(sql: string, context: string): never {
  const snippet = sql.replace(/\s+/g, " ").trim().slice(0, 240);
  throw new Error(
    `[SupabaseCompat.${context}] Legacy SQL path not rewritten yet. ` +
      `Please rewrite the calling repository to Supabase query builder.\n` +
      `SQL snippet: ${snippet}`
  );
}

export class CompatDatabase {
  constructor(private readonly _sb: SupabaseClient) {}

  /** Access the underlying Supabase client — preferred way forward. */
  get raw(): SupabaseClient {
    return this._sb;
  }

  query(sql: string): QueryResult {
    const sb = this._sb;
    return {
      get(...params: unknown[]): Record<string, unknown> | null {
        const p = params as unknown[];
        // -- Handle a set of known-safe single-row queries by rewriting inline --
        // Pattern 1: SELECT COUNT(*) as c FROM <table> [WHERE col=? ...]
        let m = /^SELECT\s+COUNT\(\*\)\s+as\s+c\s+FROM\s+(\w+)(?:\s+WHERE\s+([^;]+))?\s*;?\s*$/i.exec(
          sql
        );
        if (m) {
          const [, table, whereClause] = m;
          const { filter } = parseWhere(whereClause ?? "", p);
          // Use Supabase count option
          applyFilter(sb.from(table as never).select("*", { count: "exact", head: true }), filter);
          // fake synchronous execution using Atomics.wait on a promise — too risky; instead use a Promise that we await outside
          // Since we can't really turn async into sync, we fall back to error for now unless the caller was updated.
          return legacyNotRewritten(sql, "query.get.COUNT");
        }
        // Pattern 2: SELECT cols FROM table WHERE col=? ... LIMIT 1
        m = /^SELECT\s+([^]+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+([^]+?))?(?:\s+ORDER\s+BY\s+[^]+?)?\s+LIMIT\s+1\s*;?\s*$/i.exec(
          sql
        );
        if (m) {
          return legacyNotRewritten(sql, "query.get.SELECT_LIMIT_1");
        }
        // Everything else: not rewritten yet
        return legacyNotRewritten(sql, "query.get");
      },

      all(...params: unknown[]): Array<Record<string, unknown>> {
        const p = params as unknown[];
        // Pattern 1: SELECT cols FROM table WHERE col=? ORDER BY ... LIMIT ?
        const m1 = /^SELECT\s+([^]+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+([^]+?))?(?:\s+ORDER\s+BY\s+([^]+?))?\s*(?:LIMIT\s+(\d+|\?))?\s*;?\s*$/i.exec(
          sql
        );
        if (m1) {
          legacyNotRewritten(sql, "query.all.SELECT");
        }
        return legacyNotRewritten(sql, "query.all");
      },
    };
  }

  run(sql: string, params?: unknown[]): { changes: number } {
    const sb = this._sb;
    const p = params ?? [];
    // Pattern 1: DELETE FROM table WHERE col=?
    let m = /^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+([^;]+))?\s*;?\s*$/i.exec(sql);
    if (m) {
      legacyNotRewritten(sql, "run.DELETE");
    }
    // Pattern 2: INSERT OR IGNORE INTO table (...) VALUES (...)
    m = /^INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)\s*;?\s*$/i.exec(
      sql
    );
    if (m) {
      legacyNotRewritten(sql, "run.INSERT");
    }
    // Pattern 3: UPDATE table SET col=? WHERE ...
    m = /^UPDATE\s+(\w+)\s+SET\s+([^]+?)\s+WHERE\s+([^;]+?)\s*;?\s*$/i.exec(sql);
    if (m) {
      legacyNotRewritten(sql, "run.UPDATE");
    }
    // Pattern 4: ALTER TABLE (migrations)
    if (/^ALTER\s+TABLE/i.test(sql)) {
      return { changes: 0 }; // migrations should be done via supabase/migrations; ignore here
    }
    // Pattern 5: PRAGMA
    if (/^PRAGMA\s+/i.test(sql)) {
      return { changes: 0 };
    }
    return legacyNotRewritten(sql, "run");
  }

  prepare(sql: string): CompatStatement {
    return {
      run: (...params: unknown[]): void => {
        this.run(sql, params);
      },
      free(): void {
        /* no-op */
      },
    };
  }

  exec(sql: string): { columns: string[]; values: unknown[][] }[] {
    // PRAGMA / empty SELECT 1 / schema setup → ignore
    if (/^PRAGMA\s+/i.test(sql) || sql.trim() === "SELECT 1") return [];
    // Otherwise: error so we find and rewrite any remaining legacy exec() callers
    return legacyNotRewritten(sql, "exec");
  }

  /** Supabase client has no Uint8Array export; keep for TS compat only */
  export(): Uint8Array {
    return new Uint8Array();
  }

  close(): void {
    /* no-op */
  }
}

// ── tiny internal WHERE helper (we don't actually use these paths; kept for shape) ──
type FilterEntry = { column: string; op: "eq" | "is"; value: unknown };
function parseWhere(
  clause: string,
  _params: unknown[]
): { filter: FilterEntry[] } {
  const filter: FilterEntry[] = [];
  const parts = clause.split(/\s+AND\s+/i);
  for (const part of parts) {
    const m = /^(\w+)\s*(=|IS)\s*(\?|NULL)$/i.exec(part.trim());
    if (!m) continue;
    filter.push({ column: m[1], op: (m[2].toLowerCase() === "is" ? "is" : "eq"), value: m[3].toLowerCase() === "null" ? null : undefined });
  }
  return { filter };
}
function applyFilter(q: unknown, _filter: FilterEntry[]): unknown {
  return q; // stub: not used since we throw for legacy paths
}
