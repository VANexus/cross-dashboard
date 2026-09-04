import { CompetitorAdsClient } from "../competitor-ads-client";
import { getDbAsync } from "@/lib/server/db";
import { getRecentCompetitorAnalyses } from "@/lib/server/repositories/workflow.repository";

export async function CompetitorAdsIsland() {
  await getDbAsync();
  // 主数据改为前端实时拉 TikHub 真实广告创意库（/api/b2b/ad-intel）；
  // 这里只保留真实的历史 AI 分析记录，不再注入内置样本。
  const recentAnalyses = await getRecentCompetitorAnalyses(5).catch(() => []);

  return <CompetitorAdsClient recentAnalyses={recentAnalyses} />;
}
