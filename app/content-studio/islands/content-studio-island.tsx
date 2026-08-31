import { getDbAsync } from "@/lib/db";
import { ContentService } from "@/lib/services";
import { ContentStudioClient } from "../content-studio-client";
import { connection } from "next/server";

/**
 * SSR island：初次渲染直接调 service（不过 HTTP、无 envelope），
 * 把平台元数据 + 成果库作为 props 传给客户端；客户端用 useFetch 做实时刷新。
 *
 * connection() 使路由动态渲染（兼容 next.config cacheComponents），
 * 允许 SSR 路径使用 Date.now() 等非确定性计算。
 */
export async function ContentStudioIsland() {
  await connection();
  await getDbAsync();
  const service = new ContentService();
  return (
    <ContentStudioClient
      platforms={await service.getPlatforms()}
      works={await service.getWorks()}
    />
  );
}
