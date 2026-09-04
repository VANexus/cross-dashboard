/**
 * FlowMind — 数据库迁移执行器（运维工具）
 *
 * 用法：bun run scripts/db-migrate.ts
 * 连接：lib/cluster 目录（PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE）。
 * 幂等：schema_migrations 水位表；每个迁移单事务（unsafe 多语句 + 水位插入）。
 */
import { getPool } from "../lib/server/db/pg";
import { MIGRATIONS } from "../lib/server/db/migrations";

async function main() {
  const sql = getPool();
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;
  const done = await sql`SELECT id FROM schema_migrations`;
  const doneIds = new Set(done.map((r) => r.id as string));

  let applied = 0;
  for (const m of MIGRATIONS) {
    if (doneIds.has(m.id)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(m.sql);
      await tx.unsafe(`INSERT INTO schema_migrations (id) VALUES ($1)`, [m.id]);
    });
    applied++;
    console.log(`[migrate] applied: ${m.id}`);
  }

  const tables = await sql`
    SELECT count(*)::int AS c FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
  console.log(`[migrate] done. applied=${applied} skipped=${doneIds.size} tables=${tables[0].c}`);
  await sql.end();
}

main().catch((e) => {
  console.error("[migrate] FAILED:", e.message);
  process.exit(1);
});
