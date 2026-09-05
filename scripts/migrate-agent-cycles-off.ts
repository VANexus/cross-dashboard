/**
 * FlowMind — 一次性运维脚本：存量 Agent「自嗨循环」归位（D2·去双轨补丁）
 *
 * 用法：bun run scripts/migrate-agent-cycles-off.ts
 * 目的：2026-09-05 起老 Agent 自主 Runtime 默认不再随进程启动周期 LLM 循环。
 *   本脚本把存量 agents 表里 config.cycleConfig.enabled = true 的老记录改为 false，
 *   与 persona 种子默认值（lib/server/agent-runtime/personas.ts）对齐。
 * 幂等：已为 false 的记录自然跳过，可重复执行；parse 失败/非对象 config 跳过并计数。
 */
import { getPool } from "../lib/server/db/pg";

interface AgentRow {
  id: string;
  config: string;
}

async function main() {
  const sql = getPool();
  const rows = await sql<AgentRow[]>`SELECT id, config FROM agents`;

  let updated = 0;
  let alreadyOff = 0;
  let skipped = 0;

  for (const row of rows) {
    let cfg: Record<string, unknown>;
    try {
      cfg = JSON.parse(row.config ?? "{}") as Record<string, unknown>;
    } catch {
      skipped++; // config 非法 JSON，不动
      continue;
    }
    if (typeof cfg !== "object" || cfg === null) {
      skipped++;
      continue;
    }
    const cycle = cfg.cycleConfig as { enabled?: unknown } | undefined;
    if (cycle?.enabled === true) {
      cycle.enabled = false;
      await sql`
        UPDATE agents
        SET config = ${JSON.stringify(cfg)}, updated_at = now()
        WHERE id = ${row.id}
      `;
      updated++;
      console.log(`[cycle-off] ${row.id} → cycleConfig.enabled=false`);
    } else {
      alreadyOff++;
    }
  }

  console.log(`[cycle-off] done. total=${rows.length} updated=${updated} alreadyOff=${alreadyOff} skipped=${skipped}`);
  await sql.end();
}

main().catch((e) => {
  console.error("[cycle-off] FAILED:", e.message);
  process.exit(1);
});