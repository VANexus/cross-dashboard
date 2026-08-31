import { AiAdvertisingClient } from "../ai-advertising-client";
import { WorkflowService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";

export async function AiAdvertisingIsland() {
  await getDbAsync();
  const service = new WorkflowService();
  const recentAnalyses = await service.getRecentAdAnalyses(5);
  return (
    <AiAdvertisingClient
      adKeywords={await service.getAdKeywords()}
      recentAnalyses={recentAnalyses}
    />
  );
}
