import { AiAdvertisingClient } from "../ai-advertising-client";
import { WorkflowService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";

export async function AiAdvertisingIsland() {
  await getDbAsync();
  const service = new WorkflowService();
  const recentAnalyses = service.getRecentAdAnalyses(5);
  return (
    <AiAdvertisingClient
      adKeywords={service.getAdKeywords()}
      recentAnalyses={recentAnalyses}
    />
  );
}
