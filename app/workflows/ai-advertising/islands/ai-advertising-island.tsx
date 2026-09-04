import { AiAdvertisingClient } from "../ai-advertising-client";
import { WorkflowService } from "@/lib/server/services";
import { getDbAsync } from "@/lib/server/db";

export async function AiAdvertisingIsland() {
  await getDbAsync();
  // 竞品广告素材由客户端实时拉 TikHub 真实广告库（/api/b2b/ad-intel）；
  // 这里只保留真实的历史 AI 策略分析，不再注入内置 adKeywords 样本。
  const service = new WorkflowService();
  const recentAnalyses = await service.getRecentAdAnalyses(5).catch(() => []);
  return <AiAdvertisingClient recentAnalyses={recentAnalyses} />;
}
