import { getDbAsync } from "@/lib/db";
import { ContentService } from "@/lib/services";
import { ContentStudioClient } from "../content-studio-client";

/**
 * SSR island：初次渲染直接调 service（不过 HTTP、无 envelope），
 * 把平台元数据 + 成果库作为 props 传给客户端；客户端用 useFetch 做实时刷新。
 */
export async function ContentStudioIsland() {
  await getDbAsync();
  const service = new ContentService();
  return (
    <ContentStudioClient
      platforms={service.getPlatforms()}
      works={service.getWorks()}
    />
  );
}
