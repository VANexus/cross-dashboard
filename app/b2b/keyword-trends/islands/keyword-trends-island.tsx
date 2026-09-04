import { connection } from "next/server";
import { getDbAsync } from "@/lib/server/db";
import { B2BService } from "@/lib/server/services";
import { B2BTrendsClient } from "../b2b-trends-client";

/**
 * SSR island：初次渲染直接读库（不过 HTTP、无 envelope），
 * 把 tiktok 榜单作为初始 props；客户端用 useKeywordTrends 随平台切换实时刷新。
 */
export async function KeywordTrendsIsland() {
  await connection();
  await getDbAsync();
  const service = new B2BService();
  return <B2BTrendsClient initialTrends={await service.getKeywordTrends("tiktok")} />;
}
