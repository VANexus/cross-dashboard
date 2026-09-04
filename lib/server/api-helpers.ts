/**
 * FlowMind RAK — API route helpers
 * Wraps route handlers to ensure database is initialized before execution.
 */
import { connection } from "next/server";
import type { NextRequest } from "next/server";
import { getDbAsync } from "./db";

/**
 * Wrap an API route handler to ensure the database is ready.
 * Preserves the handler's type signature for Next.js compatibility.
 *
 * P1 连接治理：这些路由都访问 DB，绝不该被「构建期静态预渲染」抢先连库——
 * 集群 PG 连接配额有限，build 时 Next 会尝试预渲染所有未标记动态的 GET，
 * 每个 worker 各 `$connect` 一次，极易把配额打满（Too many connections）。
 * 因此先 `await connection()`：它让本 route 一律在「收到真实请求」时才执行，
 * 之后的 `getDbAsync()`/handler 全部排除在预渲染之外，DB 连接只发生在运行时。
 * 一处修改即覆盖全仓 all withDb 路由，无需逐个 route 加标记。
 */
export function withDb<T extends (request: NextRequest, ...args: never[]) => unknown>(handler: T): T {
  return (async (request: NextRequest, ...args: never[]) => {
    await connection(); // 强制 request-time：构建/预渲染不连库，运行时才初始化
    await getDbAsync();
    return handler(request, ...args);
  }) as unknown as T;
}
