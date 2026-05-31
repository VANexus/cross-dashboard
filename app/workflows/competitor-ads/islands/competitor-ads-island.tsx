import { CompetitorAdsClient } from "../competitor-ads-client";
import { WorkflowService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";
import { getRecentCompetitorAnalyses } from "@/lib/repositories/workflow.repository";

export async function CompetitorAdsIsland() {
  await getDbAsync();
  const service = new WorkflowService();
  const allKeywords = service.getCompetitorKeywords();
  const keywords = {
    core: allKeywords.filter((k) => k.type === "core"),
    longtail: allKeywords.filter((k) => k.type === "longtail"),
    competitor: allKeywords.filter((k) => k.type === "competitor"),
  };
  const recentAnalyses = getRecentCompetitorAnalyses(5);

  return (
    <CompetitorAdsClient
      keywords={keywords}
      competitors={service.getCompetitors()}
      adPositions={service.getAdPositions()}
      targetingData={[]}
      recentAnalyses={recentAnalyses}
    />
  );
}
