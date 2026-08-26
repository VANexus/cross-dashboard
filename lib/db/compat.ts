/**
 * FlowMind RAK — sql.js Compatibility Layer
 * Wraps sql.js Database to provide bun:sqlite-style API used by repositories.
 *
 * Adds:
 *   db.query(sql).get(...params)  → single row
 *   db.query(sql).all(...params)  → array of rows
 *   db.run(sql, params).changes   → rows modified
 *   db.prepare(sql).run(...params) → variadic bind + step
 */
import type { Database } from "sql.js";

interface QueryResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(...params: unknown[]): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  all(...params: unknown[]): any[];
}

interface CompatStatement {
  run(...params: unknown[]): void;
  free(): void;
}

export class CompatDatabase {
  private _db: Database;

  constructor(db: Database) {
    this._db = db;
  }

  /** Access the underlying sql.js database */
  get raw(): Database {
    return this._db;
  }

  /** Query API: db.query(sql).get(...params) / .all(...params) */
  query(sql: string): QueryResult {
    const db = this._db;
    return {
      get(...params: unknown[]): ReturnType<typeof db.exec>[number]["values"][number] | Record<string, unknown> | null {
        const stmt = db.prepare(sql);
        try {
          if (params.length > 0) stmt.bind(params as Parameters<typeof stmt.bind>[0]);
          if (stmt.step()) {
            return stmt.getAsObject() as Record<string, unknown>;
          }
          return null;
        } finally {
          stmt.free();
        }
      },
      all(...params: unknown[]): Array<Record<string, unknown>> {
        const stmt = db.prepare(sql);
        const rows: Array<Record<string, unknown>> = [];
        try {
          if (params.length > 0) stmt.bind(params as Parameters<typeof stmt.bind>[0]);
          while (stmt.step()) {
            rows.push(stmt.getAsObject() as Record<string, unknown>);
          }
          return rows;
        } finally {
          stmt.free();
        }
      },
    };
  }

  /** Run SQL (INSERT/UPDATE/DELETE). Returns { changes } like bun:sqlite */
  run(sql: string, params?: unknown[]): { changes: number } {
    if (params && params.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._db.run(sql, params as any[]);
    } else {
      this._db.run(sql);
    }
    return { changes: this._db.getRowsModified() };
  }

  /** Prepare a statement with bun:sqlite-style variadic .run() */
  prepare(sql: string): CompatStatement {
    const db = this._db;
    return {
      run(...params: unknown[]) {
        const stmt = db.prepare(sql);
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          stmt.bind(params as any[]);
          stmt.step();
        } finally {
          stmt.free();
        }
      },
      free() {},
    };
  }

  /** Execute raw SQL (for schema, PRAGMA, etc.) */
  exec(sql: string): { columns: string[]; values: unknown[][] }[] {
    return this._db.exec(sql);
  }

  /** Export database as Uint8Array */
  export(): Uint8Array {
    return this._db.export();
  }

  /** Close the database */
  close(): void {
    this._db.close();
  }
}
