/**
 * FlowMind — 集群 PG 直连池（P1 数据层，唯一 DB 入口）
 *
 * 驱动：postgres.js（Bun/Node 双运行时）。端点/凭据经 lib/cluster 服务目录解析：
 *   cluster = pg-main-rw.database.svc:5432 · dev = mesh 100.121.213.4:30432 · env 覆盖。
 *
 * 约定（P1 SQL 纪律）：
 *   - 全仓查询一律 tagged template：await db`SELECT ... WHERE x = ${v}`（参数自动绑定，禁字符串拼接）；
 *   - 时间戳列（timestamptz/timestamp）经类型转换回 ISO 字符串（应用层沿用 string 语义）；
 *   - JSONB 列直接传 JS 对象；
 *   - 事务用 db.begin(...)；长任务/多副本租约锁走 Redis，不在 PG 做。
 */
import postgres from "postgres";
import { postgresConfig } from "@/lib/cluster";

/** timestamptz(1184) / timestamp(1114) → ISO 字符串，保持应用层 string 语义 */
const iso = (v: string | Date) =>
  v instanceof Date ? v.toISOString() : new Date(v).toISOString();

let _db: postgres.Sql | null = null;

export function getPool(): postgres.Sql {
  if (!_db) {
    const c = postgresConfig();
    _db = postgres({
      host: c.host,
      port: c.port,
      user: c.user,
      password: c.password,
      database: c.database,
      // PG 槽位收敛（配额有限，dev/build 被 Too many connections 打满）：
      // - max 10→2：仅 conversation 服务用本池，2 足矣；
      // - idle_timeout 20s：空闲连接自动归还集群，杜绝「常驻空闲占槽位」；
      // - max_lifetime 30min：长连接兜底轮换，避免连接被服务端/网关超时。
      max: 2,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      connect_timeout: 10,
      onnotice: () => { /* 静默 NOTICE */ },
      types: {
        timestamp_iso: {
          to: 1114,
          from: [1114, 1184],
          serialize: iso,
          parse: iso,
        },
      },
    });
  }
  return _db;
}

/**
 * 可直接作 tagged template 使用的池引用：
 *   import { db } from "@/lib/server/db";
 *   const rows = await db`SELECT * FROM tasks WHERE id = ${id}`;
 * 属性访问（db.begin / db.reserve / db.unsafe…）同样透传。
 */
export const db: postgres.Sql = new Proxy(function () {} as unknown as postgres.Sql, {
  get(_t, prop) {
    return (getPool() as unknown as Record<string | symbol, unknown>)[prop];
  },
  apply(_t, thisArg, args) {
    return (getPool() as unknown as (...a: unknown[]) => unknown).apply(thisArg, args);
  },
});
