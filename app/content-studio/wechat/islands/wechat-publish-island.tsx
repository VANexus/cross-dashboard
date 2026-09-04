import { getDbAsync } from "@/lib/server/db";
import { ContentService, WechatService } from "@/lib/server/services";
import { WechatPublishClient } from "../wechat-publish-client";
import { connection } from "next/server";

/**
 * SSR island：初渲直接调 service（不过 HTTP、无 envelope），
 * 把账号 / 历史 / 主题 / 公众号草稿作为 props 传给客户端；
 * 客户端用 useFetch 做实时刷新。
 *
 * 账号/历史表（00011 迁移）未建时静默降级为空数组 —— 页面照常打开，
 * 客户端会展示「运行迁移」的空态提示，不阻塞排版/预览等本地能力。
 */
export async function WechatPublishIsland() {
  await connection();
  await getDbAsync();
  const service = new WechatService();
  const content = new ContentService();

  const [accounts, jobs, themes, works] = await Promise.all([
    service.getAccounts().catch(() => []),
    service.listJobs().catch(() => []),
    service.getThemes(),
    content.getWorks(),
  ]);

  return (
    <WechatPublishClient
      accounts={accounts}
      jobs={jobs}
      themes={themes}
      drafts={works.drafts.filter((d) => d.platform === "wechat")}
    />
  );
}
